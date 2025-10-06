<?php
// api/config.php

/**
 * Configuración de la Base de Datos
 * Define las constantes para la conexión a la base de datos.
 * Es una buena práctica mantener esta información sensible en un archivo separado.
 *
 * ¡IMPORTANTE! Para entornos de producción, estas credenciales no deberían
 * estar directamente en el código. Considera usar variables de entorno.
 */

// Define el host de la base de datos (normalmente 'localhost' en XAMPP)
define('DB_HOST', 'localhost');

// Define el nombre de usuario de la base de datos (normalmente 'root' en XAMPP)
define('DB_USER', 'root');

// Define la contraseña de la base de datos (normalmente vacía en XAMPP)
define('DB_PASS', '');

// Define el nombre de la base de datos que creamos con el script SQL
define('DB_NAME', 'delivery_app');

// Define el juego de caracteres para la conexión
define('DB_CHARSET', 'utf8mb4');

?>