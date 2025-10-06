<?php
// api/auth_middleware.php

// Asegúrate de que JWTUtils.php esté incluido para poder usarlo.
require_once 'JWTUtils.php';

// Obtener la cabecera Authorization
function getAuthorizationHeader(): ?string {
    $headers = null;
    // Prioridad: SERVER['Authorization'] (moderno), HTTP_AUTHORIZATION (Apache), apache_request_headers()
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) { // Para algunos servidores Apache
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } elseif (function_exists('apache_request_headers')) { // Para algunos entornos Apache
        $requestHeaders = apache_request_headers();
        // Capitaliza la primera letra de cada parte del nombre de la cabecera
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    return $headers;
}

// Función principal del middleware de autenticación
function authenticateAPI(): array {
    $authHeader = getAuthorizationHeader();

    if (empty($authHeader)) {
        http_response_code(401); // No autorizado
        echo json_encode(['message' => 'Acceso denegado. Token no proporcionado.']);
        exit();
    }

    // El token debe venir en formato "Bearer [token]"
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        http_response_code(401); // No autorizado
        echo json_encode(['message' => 'Acceso denegado. Formato de token inválido.']);
        exit();
    }

    $token = $matches[1]; // Extrae el token

    $decoded_data = JWTUtils::validateToken($token);

    if ($decoded_data === false) {
        http_response_code(401); // No autorizado
        echo json_encode(['message' => 'Acceso denegado. Token inválido o expirado.']);
        exit();
    }

    // Si el token es válido, devuelve los datos del usuario para que el script pueda usarlos
    return (array) $decoded_data; // Convertir a array para fácil acceso
}