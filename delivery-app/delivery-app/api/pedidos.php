<?php
// api/pedidos.php

// Desactiva la visualización de errores para producción.
// error_reporting(E_ALL);
// ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS"); // Añadido OPTIONS
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
//     echo json_encode(['message' => 'No tienes permisos para ver pedidos.']);
//     exit();
// }

// --- CONEXIÓN A LA BD ---
$database = new Database();
$db = $database->connect();

if (!$db) {
    http_response_code(500);
    echo json_encode(['message' => 'Error en la conexión a la base de datos.']);
    exit();
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // Obtener ID si se busca un pedido específico (ej. /pedidos.php?id=X)
        $id_pedido = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

        if ($id_pedido) {
            // Lógica para obtener un solo pedido por ID
            $query = "
                SELECT
                    p.id_pedido,
                    p.id_cliente,
                    p.id_repartidor,
                    p.fecha_pedido,
                    p.estado_pedido,
                    p.total_pedido,
                    c.nombre_completo AS cliente_nombre,
                    c.direccion AS cliente_direccion,
                    c.telefono AS cliente_telefono,
                    r.nombre_completo AS repartidor_nombre,
                    r.telefono AS repartidor_telefono,
                    r.vehiculo AS repartidor_vehiculo
                FROM
                    pedidos AS p
                LEFT JOIN
                    clientes AS c ON p.id_cliente = c.id_cliente
                LEFT JOIN
                    repartidores AS r ON p.id_repartidor = r.id_repartidor
                WHERE
                    p.id_pedido = :id_pedido
            ";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id_pedido', $id_pedido, PDO::PARAM_INT);
            $stmt->execute();
            $pedido = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($pedido) {
                // También obtener los detalles del pedido
                $query_detalles = "
                    SELECT
                        pd.id_detalle,
                        pd.id_producto,
                        pd.cantidad,
                        pd.precio_unitario,
                        pr.nombre_producto AS producto_nombre
                    FROM
                        pedido_detalles AS pd
                    JOIN
                        productos AS pr ON pd.id_producto = pr.id_producto
                    WHERE
                        pd.id_pedido = :id_pedido
                ";
                $stmt_detalles = $db->prepare($query_detalles);
                $stmt_detalles->bindParam(':id_pedido', $id_pedido, PDO::PARAM_INT);
                $stmt_detalles->execute();
                $pedido['detalles'] = $stmt_detalles->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode($pedido);
            } else {
                http_response_code(404); // No encontrado
                echo json_encode(['message' => 'Pedido no encontrado.']);
            }

        } else {
            // Lógica para obtener todos los pedidos
            $query = "
                SELECT
                    p.id_pedido,
                    p.id_repartidor,
                    p.fecha_pedido,
                    p.estado_pedido,
                    p.total_pedido,
                    c.nombre_completo AS cliente_nombre,
                    r.nombre_completo AS repartidor_nombre
                FROM
                    pedidos AS p
                LEFT JOIN
                    clientes AS c ON p.id_cliente = c.id_cliente
                LEFT JOIN
                    repartidores AS r ON p.id_repartidor = r.id_repartidor
                ORDER BY
                    p.fecha_pedido DESC
            ";

            $stmt = $db->prepare($query);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                $pedidos_arr = $stmt->fetchAll(PDO::FETCH_ASSOC);
                http_response_code(200);
                echo json_encode($pedidos_arr);
            } else {
                http_response_code(200);
                echo json_encode([]); // Devolver un array vacío si no hay pedidos
            }
        }
    } else {
        http_response_code(405); // Método no permitido si no es GET
        echo json_encode(['message' => 'Método no permitido.']);
    }

} catch (PDOException $e) {
    error_log('Pedidos PDO Error: ' . $e->getMessage()); // Registrar el error completo
    http_response_code(500); // Internal Server Error
    echo json_encode(['message' => 'Ocurrió un error en el servidor al consultar pedidos.']);
}