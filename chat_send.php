<?php

session_start();

require_once "includes/functions.php";

header("Content-Type: application/json");


if (!isset($_SESSION["user_id"])) {

    http_response_code(401);
    echo json_encode(["error" => "Not logged in."]);
    exit;

}


$userId    = (int)$_SESSION["user_id"];
$partnerId = (int)($_POST["user_id"] ?? 0);
$content   = trim($_POST["content"] ?? "");


if ($partnerId <= 0 || $partnerId === $userId) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid recipient."]);
    exit;

}


if ($content === "") {

    http_response_code(400);
    echo json_encode(["error" => "Message cannot be empty."]);
    exit;

}


if (mb_strlen($content) > 2000) {

    http_response_code(400);
    echo json_encode(["error" => "Message is too long (max 2000 characters)."]);
    exit;

}


// The recipient must exist

$stmt = $conn->prepare(
    "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $partnerId);
$stmt->execute();

if ($stmt->get_result()->num_rows === 0) {

    http_response_code(404);
    echo json_encode(["error" => "User not found."]);
    exit;

}

$stmt->close();


// Find or create the conversation (pair stored as smaller id, bigger id)

$a = min($userId, $partnerId);
$b = max($userId, $partnerId);


$stmt = $conn->prepare(
    "SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?"
);

$stmt->bind_param("ii", $a, $b);
$stmt->execute();

$conversation = $stmt->get_result()->fetch_assoc();

$stmt->close();


if ($conversation) {

    $convId = (int)$conversation["id"];

} else {

    $stmt = $conn->prepare(
        "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)"
    );

    $stmt->bind_param("ii", $a, $b);
    $stmt->execute();

    $convId = $stmt->insert_id;

    $stmt->close();

}


// Sending the message ends the "typing..." state

$typingCol = ($a === $userId) ? "user1_typing_at" : "user2_typing_at";

$stmt = $conn->prepare(
    "UPDATE conversations SET `$typingCol` = NULL WHERE id = ?"
);

$stmt->bind_param("i", $convId);
$stmt->execute();
$stmt->close();


// Insert the message

$stmt = $conn->prepare(
    "INSERT INTO messages (conversation_id, sender_id, content)
     VALUES (?, ?, ?)"
);

$stmt->bind_param("iis", $convId, $userId, $content);

$stmt->execute();

$messageId = $stmt->insert_id;

$stmt->close();


echo json_encode([
    "success" => true,
    "message" => [
        "id"      => $messageId,
        "content" => $content,
        "time"    => date("H:i"),
        "mine"    => true
    ]
]);