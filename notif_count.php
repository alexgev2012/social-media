<?php

session_start();

require_once "includes/functions.php";

header("Content-Type: application/json");


if (!isset($_SESSION["user_id"])) {

    http_response_code(401);
    echo json_encode(["error" => "Not logged in."]);
    exit;

}


echo json_encode([
    "count"    => unreadNotifications($conn, $_SESSION["user_id"]),
    "messages" => unreadMessages($conn, $_SESSION["user_id"])
]);