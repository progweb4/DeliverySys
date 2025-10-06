<?php
// api/login.php (VERSIÓN CON JWT)

// Desactiva la visualización de errores para producción.
// error_reporting(E_ALL); // Actívalo solo para depuración
// ini_set('display_errors', 1); // Actívalo solo para depuración

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
require_once 'JWTUtils.php'; // Incluimos nuestra clase JWTUtils

// --- VALIDACIÓN DEL MÉTODO ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Método no permitido.']);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

// Validar que los datos existan
if (empty($data->username) || empty($data->password)) {
    http_response_code(400);
    echo json_encode(['message' => 'Usuario y contraseña son requeridos.']);
    exit();
}

// Limpiar y validar datos
$username = htmlspecialchars(strip_tags($data->username));
$password = $data->password; // La contraseña se verifica con password_verify, no necesita sanitización

// --- CONEXIÓN A LA BD ---
$database = new Database();
$db = $database->connect();

if (!$db) {
    http_response_code(500);
    echo json_encode(['message' => 'Error en la conexión a la base de datos.']);
    exit();
}

try {
    $query = "SELECT id_usuario, nombre_usuario, password_hash, rol FROM usuarios WHERE nombre_usuario = :username LIMIT 1"; // LIMIT 1 para optimizar
    $stmt = $db->prepare($query);
    $stmt->bindParam(':username', $username);
    $stmt->execute();

    if ($stmt->rowCount() == 1) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        // Verificamos la contraseña de forma segura con el hash.
        if (password_verify($password, $user['password_hash'])) {

            // --- GENERAR JWT AL INICIO DE SESIÓN EXITOSO ---
            // Los datos que quieres incluir en el token. NO incluyas la contraseña.
            $token_data = [
                'id_usuario' => $user['id_usuario'],
                'nombre_usuario' => $user['nombre_usuario'],
                'rol' => $user['rol']
            ];
            $jwt = JWTUtils::generateToken($token_data);

            // ¡Login exitoso!
            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => 'Inicio de sesión exitoso.',
                'jwt' => $jwt, // Devolvemos el JWT
                'user' => [ // Puedes seguir devolviendo info básica del usuario si la UI la necesita
                    'id' => $user['id_usuario'],
                    'username' => $user['nombre_usuario'],
                    'rol' => $user['rol']
                ]
            ]);

        } else {
            // Contraseña incorrecta. Se da el mismo mensaje que usuario no encontrado por seguridad.
            http_response_code(401);
            echo json_encode(['message' => 'Usuario o contraseña incorrectos.']);
        }
    } else {
        // Usuario no encontrado.
        http_response_code(401);
        echo json_encode(['message' => 'Usuario o contraseña incorrectos.']);
    }

} catch (PDOException $e) {
    // En producción, registra el error y devuelve un mensaje genérico.
    error_log('Login PDO Error: ' . $e->getMessage());
    http_response_code(500); // 500 Internal Server Error
    echo json_encode(['message' => 'Ocurrió un error en el servidor. Por favor, inténtelo de nuevo más tarde.']);
}