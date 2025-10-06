<?php
// api/JWTUtils.php

// Asegúrate de que esta ruta sea correcta respecto a la ubicación de tu carpeta 'vendor'.
// Si 'api' está en la raíz de tu proyecto, entonces '../vendor/autoload.php' es correcto.
require_once __DIR__ . '/../vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/**
 * Clase de utilidad para la generación y validación de JSON Web Tokens (JWT).
 */
class JWTUtils {
    // Clave secreta para firmar y verificar los tokens.
    // ¡IMPORTANTE!: En un entorno de producción, esta clave debe ser muy segura,
    // generada aleatoriamente y almacenada en un lugar seguro (ej. variable de entorno, fuera del control de versiones).
    // NUNCA la expongas en un repositorio público ni la dejes en el código duro en producción.
    private static $secret_key = 'tu_clave_secreta_aqui_CAMBIALA_EN_PRODUCCION_POR_FAVOR_ES_MUY_IMPORTANTE'; // ¡CAMBIA ESTO!

    // Algoritmo de encriptación
    private static $alg = 'HS256';

    /**
     * Genera un nuevo JSON Web Token.
     *
     * @param array $data Los datos a incluir en el token (ej. id_usuario, rol).
     * @return string El token JWT generado.
     */
    public static function generateToken(array $data): string {
        $issuedAt = time();
        $expirationTime = $issuedAt + (3600 * 24); // Token válido por 24 horas (3600 segundos * 24)

        $payload = array(
            'iat'  => $issuedAt,          // Tiempo en que el token fue emitido
            'exp'  => $expirationTime,    // Tiempo de expiración del token
            'data' => $data               // Datos personalizados del usuario
        );

        return JWT::encode($payload, self::$secret_key, self::$alg);
    }

    /**
     * Valida un JSON Web Token.
     *
     * @param string $token El token JWT a validar.
     * @return object|false Los datos decodificados del token si es válido, o false si falla.
     */
    public static function validateToken(string $token) {
        try {
            // Decodifica el token usando la clave secreta y el algoritmo.
            $decoded = JWT::decode($token, new Key(self::$secret_key, self::$alg));
            return $decoded->data; // Devuelve solo los datos personalizados
        } catch (Exception $e) {
            // Manejo de errores de JWT (ej. token expirado, firma inválida)
            error_log('JWT Validation Error: ' . $e->getMessage());
            return false;
        }
    }
}