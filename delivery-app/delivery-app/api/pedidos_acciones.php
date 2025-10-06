<?php
// api/pedidos_acciones.php

// Desactiva la visualización de errores para producción.
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: PUT, OPTIONS"); // Añadido OPTIONS
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
// if ($user_data['rol'] !== 'admin' && $user_data['rol'] !== 'gestor_pedidos') {
//     http_response_code(403); // Prohibido
//     echo json_encode(['message' => 'No tienes permisos para actualizar pedidos.']);
//     exit();
// }

// --- VALIDACIÓN DEL MÉTODO ---
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405); // Método no permitido
    echo json_encode(['message' => 'Método no permitido. Solo PUT para actualizar.']);
    exit();
}

// --- CONEXIÓN A LA BD ---
$database = new Database();
$db = $database->connect();

if (!$db) {
    http_response_code(500);
    echo json_encode(['message' => 'Error en la conexión a la base de datos.']);
    exit();
}

// --- PROCESAMIENTO DE LA PETICIÓN ---
$data = json_decode(file_get_contents("php://input"));

// Validamos que los datos necesarios estén presentes
if (empty($data->id_pedido) || empty($data->nuevo_estado)) {
    http_response_code(400); // Petición incorrecta
    echo json_encode(['message' => 'ID del pedido y nuevo estado son requeridos.']);
    exit();
}

// Validar y sanear input
$id_pedido = filter_var($data->id_pedido, FILTER_VALIDATE_INT);
$nuevo_estado = htmlspecialchars(strip_tags($data->nuevo_estado));
$id_repartidor = isset($data->id_repartidor) ? filter_var($data->id_repartidor, FILTER_VALIDATE_INT) : null;
$id_repartidor_anterior = isset($data->id_repartidor_anterior) ? filter_var($data->id_repartidor_anterior, FILTER_VALIDATE_INT) : null;

// Validar valores del nuevo estado (importante para evitar estados inválidos)
$estados_validos = ['Pendiente', 'En preparación', 'En camino', 'Entregado', 'Cancelado'];
if (!in_array($nuevo_estado, $estados_validos)) {
    http_response_code(400);
    echo json_encode(['message' => 'Estado de pedido inválido.']);
    exit();
}

if ($id_pedido === false) {
    http_response_code(400);
    echo json_encode(['message' => 'ID de pedido inválido.']);
    exit();
}

// Usamos una transacción para asegurar la integridad de los datos.
// Si algo falla, se revierte todo.
$db->beginTransaction();

try {
    // 1. Actualizar el estado del pedido principal
    $query_pedido = "UPDATE pedidos SET estado_pedido = :nuevo_estado WHERE id_pedido = :id_pedido";
    $stmt_pedido = $db->prepare($query_pedido);
    $stmt_pedido->bindParam(':nuevo_estado', $nuevo_estado);
    $stmt_pedido->bindParam(':id_pedido', $id_pedido, PDO::PARAM_INT);
    $stmt_pedido->execute();

    // 2. Lógica adicional dependiendo del nuevo estado
    if ($nuevo_estado === 'En camino') {
        // Si se va a enviar, se necesita un repartidor
        if (empty($id_repartidor)) {
            throw new Exception("Se requiere un repartidor para poner el pedido 'En camino'.");
        }
        if ($id_repartidor === false) { // Validación de ID de repartidor
            throw new Exception("ID de repartidor inválido.");
        }

        // 2a. Asignar el repartidor al pedido
        $query_asignar = "UPDATE pedidos SET id_repartidor = :id_repartidor WHERE id_pedido = :id_pedido";
        $stmt_asignar = $db->prepare($query_asignar);
        $stmt_asignar->bindParam(':id_repartidor', $id_repartidor, PDO::PARAM_INT);
        $stmt_asignar->bindParam(':id_pedido', $id_pedido, PDO::PARAM_INT);
        $stmt_asignar->execute();

        // 2b. Poner al repartidor como 'ocupado'
        $query_repartidor = "UPDATE repartidores SET estado = 'ocupado' WHERE id_repartidor = :id_repartidor AND estado = 'disponible'"; // Solo si está disponible
        $stmt_repartidor = $db->prepare($query_repartidor);
        $stmt_repartidor->bindParam(':id_repartidor', $id_repartidor, PDO::PARAM_INT);
        $stmt_repartidor->execute();

        // Opcional: Verificar si el repartidor fue realmente asignado/actualizado
        // if ($stmt_repartidor->rowCount() == 0) {
        //     throw new Exception("El repartidor no pudo ser asignado o ya estaba ocupado.");
        // }

    } else if ($nuevo_estado === 'Entregado' && !empty($id_repartidor_anterior)) {
        // 2c. Si se entregó y había un repartidor asignado, liberar al repartidor
        if ($id_repartidor_anterior === false) {
             error_log("ID de repartidor anterior inválido al intentar liberar: " . $id_repartidor_anterior);
        } else {
            $query_repartidor = "UPDATE repartidores SET estado = 'disponible' WHERE id_repartidor = :id_repartidor";
            $stmt_repartidor = $db->prepare($query_repartidor);
            $stmt_repartidor->bindParam(':id_repartidor', $id_repartidor_anterior, PDO::PARAM_INT);
            $stmt_repartidor->execute();
        }
        // También puedes limpiar el id_repartidor del pedido si ya no es relevante
        // UPDATE pedidos SET id_repartidor = NULL WHERE id_pedido = :id_pedido
    } else if ($nuevo_estado === 'Cancelado' && !empty($id_repartidor_anterior)) {
        // Si el pedido se cancela y tenía un repartidor, liberarlo
        if ($id_repartidor_anterior === false) {
             error_log("ID de repartidor anterior inválido al intentar liberar por cancelación: " . $id_repartidor_anterior);
        } else {
            $query_repartidor = "UPDATE repartidores SET estado = 'disponible' WHERE id_repartidor = :id_repartidor";
            $stmt_repartidor = $db->prepare($query_repartidor);
            $stmt_repartidor->bindParam(':id_repartidor', $id_repartidor_anterior, PDO::PARAM_INT);
            $stmt_repartidor->execute();
        }
    }


    // Si todo salió bien, confirmamos los cambios en la base de datos
    $db->commit();
    http_response_code(200);
    echo json_encode(['message' => 'Pedido actualizado correctamente.']);

} catch (Exception $e) {
    // Si algo falló, revertimos todos los cambios
    $db->rollBack();
    error_log('Pedidos Acciones Error: ' . $e->getMessage()); // Registrar el error completo
    http_response_code(500); // Internal Server Error
    echo json_encode(['message' => 'No se pudo actualizar el pedido.', 'error' => $e->getMessage()]);
}