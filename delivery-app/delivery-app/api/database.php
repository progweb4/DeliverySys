// api/database.php

/**
 * Clase Database
 * Se encarga de gestionar la conexión a la base de datos utilizando PDO.
 * Sigue el patrón Singleton para asegurar que solo exista una instancia
 * de la conexión en toda la aplicación.
 */
class Database {

    // Propiedades de la conexión estáticas para el Singleton.
    private static $host = DB_HOST;
    private static $db_name = DB_NAME;
    private static $username = DB_USER;
    private static $password = DB_PASS;
    private static $charset = DB_CHARSET;

    // La conexión PDO estática
    private static $conn;

    // Constructor privado para evitar la instanciación externa (Singleton)
    private function __construct() {
        // Nada que hacer aquí.
    }

    // Métodos mágicos privados para evitar clonación y deserialización (Singleton)
    private function __clone() {}
    public function __wakeup() {
        throw new \Exception("Cannot deserialize a singleton");
    }    public function connect() {
        // Si la conexión ya está establecida, la retornamos para no crear una nueva.
        if ($this->conn) {
            return $this->conn;
        }

        // DSN (Data Source Name) - La cadena de conexión para PDO
        $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=" . $this->charset;

        // Opciones de PDO para un manejo de errores robusto y mejores resultados
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Lanza excepciones en caso de error
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Devuelve los resultados como arrays asociativos
            PDO::ATTR_EMULATE_PREPARES   => false,                  // Usa preparaciones de sentencias nativas de MySQL
        ];

        try {
            // Intentamos crear la instancia de PDO
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch (PDOException $e) {
            // Si la conexión falla, mostramos un error genérico y registramos el detalle.
            // En un entorno de producción, nunca mostrarías $e->getMessage() al usuario.
            error_log('Connection Error: ' . $e->getMessage());
            // En producción, aquí podrías devolver un error genérico como:
            // http_response_code(500); echo json_encode(['message' => 'Error interno del servidor.']); exit();
            $this->conn = null;
        }

        return $this->conn;
    }
}

?>
