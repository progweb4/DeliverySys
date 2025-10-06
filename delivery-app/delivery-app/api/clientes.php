<?php
// api/clientes.php

// Desactiva la visualización de errores para producción.
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS"); // Añadido OPTIONS
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
// if ($user_data['rol'] !== 'admin') {
//     http_response_code(403); // Prohibido
//     echo json_encode(['message' => 'No tienes permisos para gestionar clientes.']);
//     exit();
// }

$database = new Database();
$db = $database->connect();

if (!$db) {
    http_response_code(500);
    echo json_encode(['message' => 'Error en la conexión a la base de datos.']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents("php://input")); // Leer el cuerpo de la petición para POST/PUT/DELETE

try {
    switch ($method) {
        case 'GET':
            $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
            if ($id) {
                // Obtener un solo cliente
                $query = "SELECT id_cliente, nombre_completo, direccion, telefono FROM clientes WHERE id_cliente = :id LIMIT 1";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
                $cliente = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($cliente) {
                    http_response_code(200);
                    echo json_encode($cliente);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Cliente no encontrado.']);
                }
            } else {
                // Obtener todos los clientes
                $query = "SELECT id_cliente, nombre_completo, direccion, telefono FROM clientes ORDER BY nombre_completo ASC";
                $stmt = $db->prepare($query);
                $stmt->execute();
                http_response_code(200);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            }
            break;

        case 'POST': // Crear cliente
            if (empty($data->nombre_completo) || empty($data->direccion) || empty($data->telefono)) {
                http_response_code(400);
                echo json_encode(['message' => 'Nombre, dirección y teléfono son requeridos para crear.']);
                exit();
            }
            $nombre_completo = htmlspecialchars(strip_tags($data->nombre_completo));
            $direccion = htmlspecialchars(strip_tags($data->direccion));
            $telefono = htmlspecialchars(strip_tags($data->telefono));

            $query = "INSERT INTO clientes (nombre_completo, direccion, telefono) VALUES (:nombre_completo, :direccion, :telefono)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':nombre_completo', $nombre_completo);
            $stmt->bindParam(':direccion', $direccion);
            $stmt->bindParam(':telefono', $telefono);

            if ($stmt->execute()) {
                http_response_code(201); // Created
                echo json_encode(['message' => 'Cliente creado exitosamente.', 'id_cliente' => $db->lastInsertId()]);
            } else {
                http_response_code(500); // Internal Server Error
                error_log('Error creando cliente: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo crear el cliente.']);
            }
            break;

        case 'PUT': // Actualizar cliente
            if (empty($data->id_cliente) || !is_numeric($data->id_cliente) || empty($data->nombre_completo) || empty($data->direccion) || empty($data->telefono)) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de cliente, nombre, dirección y teléfono son requeridos para actualizar.']);
                exit();
            }
            $id_cliente = filter_var($data->id_cliente, FILTER_VALIDATE_INT);
            $nombre_completo = htmlspecialchars(strip_tags($data->nombre_completo));
            $direccion = htmlspecialchars(strip_tags($data->direccion));
            $telefono = htmlspecialchars(strip_tags($data->telefono));

            if ($id_cliente === false) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de cliente inválido.']);
                exit();
            }

            $query = "UPDATE clientes SET nombre_completo = :nombre_completo, direccion = :direccion, telefono = :telefono WHERE id_cliente = :id_cliente";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id_cliente', $id_cliente, PDO::PARAM_INT);
            $stmt->bindParam(':nombre_completo', $nombre_completo);
            $stmt->bindParam(':direccion', $direccion);
            $stmt->bindParam(':telefono', $telefono);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                    http_response_code(200);
                    echo json_encode(['message' => 'Cliente actualizado exitosamente.']);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Cliente no encontrado o no hubo cambios.']);
                }
            } else {
                http_response_code(500);
                error_log('Error actualizando cliente: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo actualizar el cliente.']);
            }
            break;

        case 'DELETE': // Eliminar cliente
            if (empty($data->id_cliente) || !is_numeric($data->id_cliente)) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de cliente es requerido para eliminar.']);
                exit();
            }
            $id_cliente = filter_var($data->id_cliente, FILTER_VALIDATE_INT);

            if ($id_cliente === false) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de cliente inválido.']);
                exit();
            }

            $query = "DELETE FROM clientes WHERE id_cliente = :id_cliente";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id_cliente', $id_cliente, PDO::PARAM_INT);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                    http_response_code(200);
                    echo json_encode(['message' => 'Cliente eliminado exitosamente.']);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Cliente no encontrado.']);
                }
            } else {
                http_response_code(500);
                error_log('Error eliminando cliente: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo eliminar el cliente.']);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['message' => 'Método no permitido.']);
            break;
    }
} catch (PDOException $e) {
    error_log('Clientes API Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Ocurrió un error en el servidor al procesar la solicitud de clientes.']);
}