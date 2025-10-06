<?php
// api/generar_hash.php

// Este script simple genera un hash seguro para una contraseña.
// Úsalo para asegurarte de que el hash es compatible con tu versión de PHP.
// NO debe estar accesible en un entorno de producción.

// La contraseña que quieres usar.
$password = '1234'; // Cambia esto por la contraseña que necesites

// Generamos el hash usando el algoritmo recomendado por PHP (bcrypt por defecto).
$hash = password_hash($password, PASSWORD_DEFAULT);

// Mostramos el hash en la pantalla.
echo "Copia este hash y pégalo en la columna 'password_hash' de tu usuario 'admin' o el usuario que desees:";
echo "<br><br>";
echo "<strong>" . htmlspecialchars($hash) . "</strong>"; // htmlspecialchars para evitar XSS si el hash contiene < o >

?>