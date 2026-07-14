<?php

$host = "localhost";
$username = "root";
$password = "root";
$database = "aleksgevorgyan";
$port = 8889;

$conn = new mysqli(
    $host,
    $username,
    $password,
    $database,
    $port
);

if ($conn->connect_error) {
    die("Database connection failed: " . $conn->connect_error);
}

$conn->set_charset("utf8mb4");

?>