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
$partnerId = (int)($_GET["user"] ?? 0);
$after     = (int)($_GET["after"] ?? 0);


if ($partnerId <= 0 || $partnerId === $userId) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid conversation."]);
    exit;

}


// Find the conversation (plus the typing timestamps)

$a = min($userId, $partnerId);
$b = max($userId, $partnerId);


$stmt = $conn->prepare(
    "SELECT id, user1_id,
            user1_typing_at, user2_typing_at
     FROM conversations
     WHERE user1_id = ? AND user2_id = ?"
);

$stmt->bind_param("ii", $a, $b);
$stmt->execute();

$conversation = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$conversation) {

    echo json_encode(["messages" => [], "typing" => false, "read_up_to" => 0]);
    exit;

}


$convId = (int)$conversation["id"];


// New messages since what the chat page already shows

$stmt = $conn->prepare(
    "SELECT id, sender_id, content, created_at
     FROM messages
     WHERE conversation_id = ? AND id > ?
     ORDER BY id ASC"
);

$stmt->bind_param("ii", $convId, $after);
$stmt->execute();

$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


// I'm looking at the chat → their new messages count as read

$stmt = $conn->prepare(
    "UPDATE messages SET is_read = 1
     WHERE conversation_id = ? AND sender_id = ? AND is_read = 0"
);

$stmt->bind_param("ii", $convId, $partnerId);
$stmt->execute();
$stmt->close();


/*
 * Is the partner typing right now?
 * "Now" means: their typing timestamp is fresher than 5 seconds.
 * (They ping it every 2s while typing, so it stays fresh.)
 */

$partnerTypingAt = ((int)$conversation["user1_id"] === $partnerId)
                 ? $conversation["user1_typing_at"]
                 : $conversation["user2_typing_at"];

$typing = $partnerTypingAt !== null
       && (time() - strtotime($partnerTypingAt)) < 5;


/*
 * How far have THEY read MY messages?
 * The highest id of my messages marked read — the chat page turns
 * every ✓✓ up to that id blue.
 */

$stmt = $conn->prepare(
    "SELECT COALESCE(MAX(id), 0) AS read_up_to
     FROM messages
     WHERE conversation_id = ? AND sender_id = ? AND is_read = 1"
);

$stmt->bind_param("ii", $convId, $userId);
$stmt->execute();

$readUpTo = (int)$stmt->get_result()->fetch_assoc()["read_up_to"];

$stmt->close();


$messages = [];

foreach ($rows as $m) {

    $messages[] = [
        "id"      => (int)$m["id"],
        "content" => $m["content"],
        "time"    => date("H:i", strtotime($m["created_at"])),
        "mine"    => (int)$m["sender_id"] === $userId
    ];

}


echo json_encode([
    "messages"   => $messages,
    "typing"     => $typing,
    "read_up_to" => $readUpTo
]);