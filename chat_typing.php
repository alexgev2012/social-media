<?php

session_start();

require_once "includes/database.php";

header("Content-Type: application/json");


if (!isset($_SESSION["user_id"])) {

    http_response_code(401);
    echo json_encode(["error" => "Not logged in."]);
    exit;

}


$userId    = (int)$_SESSION["user_id"];
$partnerId = (int)($_POST["user_id"] ?? 0);


if ($partnerId <= 0 || $partnerId === $userId) {

    echo json_encode(["ok" => true]);
    exit;

}


// Find the conversation — no conversation yet means nothing to do
// (it gets created with the first message)

$a = min($userId, $partnerId);
$b = max($userId, $partnerId);


$stmt = $conn->prepare(
    "SELECT id, user1_id FROM conversations WHERE user1_id = ? AND user2_id = ?"
);

$stmt->bind_param("ii", $a, $b);
$stmt->execute();

$conversation = $stmt->get_result()->fetch_assoc();

$stmt->close();


if ($conversation) {


    // Refresh MY side's typing timestamp

    $column = ((int)$conversation["user1_id"] === $userId)
            ? "user1_typing_at"
            : "user2_typing_at";


    $stmt = $conn->prepare(
        "UPDATE conversations SET `$column` = NOW() WHERE id = ?"
    );

    $stmt->bind_param("i", $conversation["id"]);
    $stmt->execute();
    $stmt->close();

}


echo json_encode(["ok" => true]);