<?php
// api/productos.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';
require_once 'database.php';
require_once 'JWTUtils.php';
require_once 'auth_middleware.php';

$user_data = authenticateAPI();

$database = new Database();
$db = $database->connect();

if (!$db) {
    http_response_code(500);
    echo json_encode(['message' => 'Error en la conexión a la base de datos.']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents("php://input"));

try {
    switch ($method) {
        // Los casos GET, POST, y PUT permanecen iguales...
        case 'GET':
            $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
            if ($id) {
                $query = "SELECT id_producto, nombre_producto, descripcion, precio, stock, categoria FROM productos WHERE id_producto = :id LIMIT 1";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
                $producto = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($producto) {
                    http_response_code(200);
                    echo json_encode($producto);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Producto no encontrado.']);
                }
            } else {
                $query = "SELECT id_producto, nombre_producto, descripcion, precio, stock, categoria FROM productos ORDER BY nombre_producto ASC";
                $stmt = $db->prepare($query);
                $stmt->execute();
                http_response_code(200);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            }
            break;

        case 'POST':
            if (empty($data->nombre) || !isset($data->precio) || !is_numeric($data->precio) || $data->precio < 0 ||
                !isset($data->stock) || !is_numeric($data->stock) || $data->stock < 0) {
                http_response_code(400);
                echo json_encode(['message' => 'Nombre, precio (numérico >= 0) y stock (numérico >= 0) son requeridos para crear.']);
                exit();
            }
            $nombre = htmlspecialchars(strip_tags($data->nombre));
            $descripcion = htmlspecialchars(strip_tags($data->descripcion ?? ''));
            $precio = (float)$data->precio;
            $stock = (int)$data->stock;
            $categoria = htmlspecialchars(strip_tags($data->categoria ?? 'General'));

            $query = "INSERT INTO productos (nombre_producto, descripcion, precio, stock, categoria) VALUES (:nombre, :descripcion, :precio, :stock, :categoria)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':nombre', $nombre);
            $stmt->bindParam(':descripcion', $descripcion);
            $stmt->bindParam(':precio', $precio);
            $stmt->bindParam(':stock', $stock, PDO::PARAM_INT);
            $stmt->bindParam(':categoria', $categoria);

            if ($stmt->execute()) {
                http_response_code(201);
                echo json_encode(['message' => 'Producto creado exitosamente.', 'id_producto' => $db->lastInsertId()]);
            } else {
                http_response_code(500);
                error_log('Error creando producto: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo crear el producto.']);
            }
            break;

        case 'PUT':
            if (empty($data->id) || !is_numeric($data->id) ||
                empty($data->nombre) || !isset($data->precio) || !is_numeric($data->precio) || $data->precio < 0 ||
                !isset($data->stock) || !is_numeric($data->stock) || $data->stock < 0) {
                http_response_code(400);
                echo json_encode(['message' => 'ID, nombre, precio (numérico >= 0) y stock (numérico >= 0) son requeridos para actualizar.']);
                exit();
            }
            $id = filter_var($data->id, FILTER_VALIDATE_INT);
            $nombre = htmlspecialchars(strip_tags($data->nombre));
            $descripcion = htmlspecialchars(strip_tags($data->descripcion ?? ''));
            $precio = (float)$data->precio;
            $stock = (int)$data->stock;
            $categoria = htmlspecialchars(strip_tags($data->categoria ?? 'General'));

            if ($id === false) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de producto inválido.']);
                exit();
            }

            $query = "UPDATE productos SET nombre_producto = :nombre, descripcion = :descripcion, precio = :precio, stock = :stock, categoria = :categoria WHERE id_producto = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':nombre', $nombre);
            $stmt->bindParam(':descripcion', $descripcion);
            $stmt->bindParam(':precio', $precio);
            $stmt->bindParam(':stock', $stock, PDO::PARAM_INT);
            $stmt->bindParam(':categoria', $categoria);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                    http_response_code(200);
                    echo json_encode(['message' => 'Producto actualizado exitosamente.']);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Producto no encontrado o no hubo cambios.']);
                }
            } else {
                http_response_code(500);
                error_log('Error actualizando producto: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo actualizar el producto.']);
            }
            break;

        // --- INICIO DEL BLOQUE DELETE MODIFICADO ---
        case 'DELETE':
            if (empty($data->id) || !is_numeric($data->id)) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de producto es requerido para eliminar.']);
                exit();
            }
            $id = filter_var($data->id, FILTER_VALIDATE_INT);

            if ($id === false) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de producto inválido.']);
                exit();
            }

            // Iniciar una transacción
            $db->beginTransaction();

            try {
                // Paso 1: Eliminar las referencias en pedido_detalles
                $query_details = "DELETE FROM pedido_detalles WHERE id_producto = :id";
                $stmt_details = $db->prepare($query_details);
                $stmt_details->bindParam(':id', $id, PDO::PARAM_INT);
                $stmt_details->execute();

                // Paso 2: Eliminar el producto principal de la tabla productos
                $query_product = "DELETE FROM productos WHERE id_producto = :id";
                $stmt_product = $db->prepare($query_product);
                $stmt_product->bindParam(':id', $id, PDO::PARAM_INT);
                $stmt_product->execute();

                // Si todo fue exitoso, confirmar la transacción
                $db->commit();

                if ($stmt_product->rowCount() > 0) {
                    http_response_code(200);
                    echo json_encode(['message' => 'Producto y sus referencias en pedidos han sido eliminados.']);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Producto no encontrado.']);
                }

            } catch (Exception $e) {
                // Si algo falla, revertir todos los cambios
                $db->rollBack();
                error_log('Error en la transacción de borrado: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['message' => 'No se pudo completar la eliminación del producto.', 'error' => $e->getMessage()]);
            }
            break;
        // --- FIN DEL BLOQUE DELETE MODIFICADO ---

        default:
            http_response_code(405);
            echo json_encode(['message' => 'Método no permitido.']);
            break;
    }
} catch (PDOException $e) {
    error_log('Productos API Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Ocurrió un error en el servidor al procesar la solicitud de productos.']);
}