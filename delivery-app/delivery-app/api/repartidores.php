<?php
// api/repartidores.php

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
// if ($user_data['rol'] !== 'admin' && $user_data['rol'] !== 'gestor_repartidores') {
//     http_response_code(403); // Prohibido
//     echo json_encode(['message' => 'No tienes permisos para gestionar repartidores.']);
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
                // Obtener un solo repartidor
                $query = "SELECT id_repartidor, nombre_completo, telefono, vehiculo, estado FROM repartidores WHERE id_repartidor = :id LIMIT 1";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':id', $id, PDO::PARAM_INT);
                $stmt->execute();
                $repartidor = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($repartidor) {
                    http_response_code(200);
                    echo json_encode($repartidor);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Repartidor no encontrado.']);
                }
            } else {
                // Obtener todos los repartidores
                $query = "SELECT id_repartidor, nombre_completo, telefono, vehiculo, estado FROM repartidores ORDER BY nombre_completo ASC";
                $stmt = $db->prepare($query);
                $stmt->execute();
                http_response_code(200);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            }
            break;

        case 'POST': // Crear repartidor
            if (empty($data->nombre_completo) || empty($data->telefono) || empty($data->vehiculo)) {
                http_response_code(400);
                echo json_encode(['message' => 'Nombre, teléfono y vehículo son requeridos para crear.']);
                exit();
            }
            $nombre_completo = htmlspecialchars(strip_tags($data->nombre_completo));
            $telefono = htmlspecialchars(strip_tags($data->telefono));
            $vehiculo = htmlspecialchars(strip_tags($data->vehiculo));
            $estado = htmlspecialchars(strip_tags($data->estado ?? 'disponible')); // Estado por defecto

            $estados_validos = ['disponible', 'ocupado', 'inactivo'];
            if (!in_array($estado, $estados_validos)) {
                http_response_code(400);
                echo json_encode(['message' => 'Estado de repartidor inválido.']);
                exit();
            }

            $query = "INSERT INTO repartidores (nombre_completo, telefono, vehiculo, estado) VALUES (:nombre_completo, :telefono, :vehiculo, :estado)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':nombre_completo', $nombre_completo);
            $stmt->bindParam(':telefono', $telefono);
            $stmt->bindParam(':vehiculo', $vehiculo);
            $stmt->bindParam(':estado', $estado);

            if ($stmt->execute()) {
                http_response_code(201); // Created
                echo json_encode(['message' => 'Repartidor creado exitosamente.', 'id_repartidor' => $db->lastInsertId()]);
            } else {
                http_response_code(500);
                error_log('Error creando repartidor: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo crear el repartidor.']);
            }
            break;

        case 'PUT': // Actualizar repartidor
            if (empty($data->id_repartidor) || !is_numeric($data->id_repartidor) || empty($data->nombre_completo) || empty($data->telefono) || empty($data->vehiculo) || empty($data->estado)) {
                http_response_code(400);
                echo json_encode(['message' => 'ID, nombre, teléfono, vehículo y estado son requeridos para actualizar.']);
                exit();
            }
            $id_repartidor = filter_var($data->id_repartidor, FILTER_VALIDATE_INT);
            $nombre_completo = htmlspecialchars(strip_tags($data->nombre_completo));
            $telefono = htmlspecialchars(strip_tags($data->telefono));
            $vehiculo = htmlspecialchars(strip_tags($data->vehiculo));
            $estado = htmlspecialchars(strip_tags($data->estado));

            $estados_validos = ['disponible', 'ocupado', 'inactivo'];
            if (!in_array($estado, $estados_validos)) {
                http_response_code(400);
                echo json_encode(['message' => 'Estado de repartidor inválido.']);
                exit();
            }
            if ($id_repartidor === false) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de repartidor inválido.']);
                exit();
            }

            $query = "UPDATE repartidores SET nombre_completo = :nombre_completo, telefono = :telefono, vehiculo = :vehiculo, estado = :estado WHERE id_repartidor = :id_repartidor";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id_repartidor', $id_repartidor, PDO::PARAM_INT);
            $stmt->bindParam(':nombre_completo', $nombre_completo);
            $stmt->bindParam(':telefono', $telefono);
            $stmt->bindParam(':vehiculo', $vehiculo);
            $stmt->bindParam(':estado', $estado);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                    http_response_code(200);
                    echo json_encode(['message' => 'Repartidor actualizado exitosamente.']);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Repartidor no encontrado o no hubo cambios.']);
                }
            } else {
                http_response_code(500);
                error_log('Error actualizando repartidor: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo actualizar el repartidor.']);
            }
            break;

        case 'DELETE': // Eliminar repartidor
            if (empty($data->id_repartidor) || !is_numeric($data->id_repartidor)) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de repartidor es requerido para eliminar.']);
                exit();
            }
            $id_repartidor = filter_var($data->id_repartidor, FILTER_VALIDATE_INT);

            if ($id_repartidor === false) {
                http_response_code(400);
                echo json_encode(['message' => 'ID de repartidor inválido.']);
                exit();
            }

            $query = "DELETE FROM repartidores WHERE id_repartidor = :id_repartidor";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id_repartidor', $id_repartidor, PDO::PARAM_INT);

            if ($stmt->execute()) {
                if ($stmt->rowCount() > 0) {
                    http_response_code(200);
                    echo json_encode(['message' => 'Repartidor eliminado exitosamente.']);
                } else {
                    http_response_code(404);
                    echo json_encode(['message' => 'Repartidor no encontrado.']);
                }
            } else {
                http_response_code(500);
                error_log('Error eliminando repartidor: ' . json_encode($stmt->errorInfo()));
                echo json_encode(['message' => 'No se pudo eliminar el repartidor.']);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['message' => 'Método no permitido.']);
            break;
    }
} catch (PDOException $e) {
    error_log('Repartidores API Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Ocurrió un error en el servidor al procesar la solicitud de repartidores.']);
}