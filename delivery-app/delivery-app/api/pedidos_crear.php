<?php
// api/pedidos_crear.php

// Desactiva la visualización de errores para producción.
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS"); // Añadido OPTIONS
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// MANEJO DE LA PETICIÓN PREFLIGHT (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200); // Responde con éxito para la petición preflight
    exit();
}

require_once 'config.php';
require_once 'database.php';
require_once 'JWTUtils.php';
require_once 'auth_middleware.php';

// Validar el token JWT. Esto detendrá la ejecución si el token es inválido/ausente.
$user_data = authenticateAPI();

// Ejemplo de verificación de rol:
// if ($user_data['rol'] !== 'admin' && $user_data['rol'] !== 'creador_pedidos') {
//     http_response_code(403); // Prohibido
//     echo json_encode(['message' => 'No tienes permisos para crear pedidos.']);
//     exit();
// }

// --- CONEXIÓN A LA BD ---
$database = new Database();
$db = $database->connect();

try {
    $db = Database::getConnection();
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Error interno del servidor: ' . $e->getMessage()]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Método no permitido. Solo POST para crear.']);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

// Validamos que los datos necesarios existan y sean del tipo correcto
if (empty($data->id_cliente) || !is_numeric($data->id_cliente) || empty($data->detalles) || !is_array($data->detalles)) {
    http_response_code(400);
    echo json_encode(['message' => 'ID del cliente (numérico) y una lista de productos (array) son requeridos.']);
    exit();
}

// Validar que el cliente exista
$query_check_cliente = "SELECT COUNT(*) FROM clientes WHERE id_cliente = :id_cliente";
$stmt_check_cliente = $db->prepare($query_check_cliente);
$stmt_check_cliente->bindParam(':id_cliente', $data->id_cliente, PDO::PARAM_INT);
$stmt_check_cliente->execute();
if ($stmt_check_cliente->fetchColumn() === 0) {
    http_response_code(404);
    echo json_encode(['message' => 'Cliente no encontrado.']);
    exit();
}


// Iniciamos una transacción para asegurar que todas las operaciones se completen o ninguna lo haga.
$db->beginTransaction();

try {
    $total_pedido = 0;
    $productos_a_actualizar_stock = []; // Para almacenar productos y cantidades a restar

    // 1. Validar detalles y calcular el total del pedido
    foreach ($data->detalles as $item) {
        // Validar que cada item tenga los campos necesarios y sean del tipo correcto
        if (empty($item->id_producto) || !is_numeric($item->id_producto) ||
            empty($item->cantidad) || !is_numeric($item->cantidad) || $item->cantidad <= 0 ||
            empty($item->precio) || !is_numeric($item->precio) || $item->precio < 0) {
            throw new Exception("Datos de producto inválidos en el detalle del pedido.");
        }

        // Recuperar precio real y stock del producto de la DB para evitar manipulaciones del cliente
        $query_producto_info = "SELECT precio, stock FROM productos WHERE id_producto = :id_producto";
        $stmt_producto_info = $db->prepare($query_producto_info);
        $stmt_producto_info->bindParam(':id_producto', $item->id_producto, PDO::PARAM_INT);
        $stmt_producto_info->execute();
        $producto_db = $stmt_producto_info->fetch(PDO::FETCH_ASSOC);

        if (!$producto_db) {
            throw new Exception("Producto con ID " . $item->id_producto . " no encontrado.");
        }

        if ($producto_db['stock'] < $item->cantidad) {
            throw new Exception("Stock insuficiente para el producto " . $item->id_producto . ". Stock disponible: " . $producto_db['stock'] . ", solicitado: " . $item->cantidad);
        }

        // Usar el precio de la base de datos para el cálculo del total
        $precio_unitario_real = (float)$producto_db['precio'];
        $total_pedido += $precio_unitario_real * (int)$item->cantidad;

        // Almacenar para actualizar stock después
        $productos_a_actualizar_stock[] = [
            'id_producto' => (int)$item->id_producto,
            'cantidad' => (int)$item->cantidad,
            'precio_unitario_usado' => $precio_unitario_real
        ];
    }

    // 2. Insertar la cabecera del pedido en la tabla `pedidos`
    $query_pedido = "INSERT INTO pedidos (id_cliente, total_pedido, fecha_pedido, estado_pedido) VALUES (:id_cliente, :total_pedido, NOW(), 'Pendiente')";
    $stmt_pedido = $db->prepare($query_pedido);

    $stmt_pedido->bindParam(':id_cliente', $data->id_cliente, PDO::PARAM_INT);
    $stmt_pedido->bindParam(':total_pedido', $total_pedido);

    $stmt_pedido->execute();

    // 3. Obtener el ID del pedido que acabamos de crear
    $id_pedido_nuevo = $db->lastInsertId();

    // 4. Insertar cada producto del carrito en la tabla `pedido_detalles` y actualizar stock
    $query_detalle = "INSERT INTO pedido_detalles (id_pedido, id_producto, cantidad, precio_unitario) VALUES (:id_pedido, :id_producto, :cantidad, :precio_unitario)";
    $stmt_detalle = $db->prepare($query_detalle);

    $query_stock = "UPDATE productos SET stock = stock - :cantidad WHERE id_producto = :id_producto";
    $stmt_stock = $db->prepare($query_stock);


    foreach ($productos_a_actualizar_stock as $item) {
        // Insertar detalle
        $stmt_detalle->bindParam(':id_pedido', $id_pedido_nuevo, PDO::PARAM_INT);
        $stmt_detalle->bindParam(':id_producto', $item['id_producto'], PDO::PARAM_INT);
        $stmt_detalle->bindParam(':cantidad', $item['cantidad'], PDO::PARAM_INT);
        $stmt_detalle->bindParam(':precio_unitario', $item['precio_unitario_usado']);
        $stmt_detalle->execute();

        // Actualizar stock
        $stmt_stock->bindParam(':cantidad', $item['cantidad'], PDO::PARAM_INT);
        $stmt_stock->bindParam(':id_producto', $item['id_producto'], PDO::PARAM_INT);
        $stmt_stock->execute();
    }

    // 5. Si todo salió bien, confirmamos la transacción
    $db->commit();

    http_response_code(201); // 201 Created
    echo json_encode(['message' => 'Pedido creado exitosamente.', 'id_pedido' => $id_pedido_nuevo]);

} catch (Exception $e) {
    // Si algo falla, revertimos todos los cambios para no dejar datos corruptos
    $db->rollBack();
    error_log('Pedidos Crear Error: ' . $e->getMessage()); // Registrar el error completo
    http_response_code(500); // Internal Server Error
    echo json_encode(['message' => 'No se pudo crear el pedido.', 'error' => $e->getMessage()]);

}
