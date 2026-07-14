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
$commentId = (int)($_POST["comment_id"] ?? 0);


if ($commentId <= 0) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid comment."]);
    exit;

}


// The comment must exist — grab its author for the notification
// (user_id is a TEXT column, so cast it)

$stmt = $conn->prepare(
    "SELECT CAST(user_id AS UNSIGNED) AS author
     FROM comments
     WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $commentId);
$stmt->execute();

$comment = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$comment) {

    http_response_code(404);
    echo json_encode(["error" => "Comment not found."]);
    exit;

}


$author = (int)$comment["author"];


// Toggle — likes table, content_type = 'comment'
// (post likes, story likes, comment likes: one table, three types)

$stmt = $conn->prepare(
    "SELECT id, deleted_at
     FROM likes
     WHERE user_id = ? AND content_type = 'comment' AND content_id = ?"
);

$stmt->bind_param("ii", $userId, $commentId);
$stmt->execute();

$existing = $stmt->get_result()->fetch_assoc();

$stmt->close();


if ($existing === null) {

    $stmt = $conn->prepare(
        "INSERT INTO likes (user_id, content_type, content_id, status)
         VALUES (?, 'comment', ?, 0)"
    );

    $stmt->bind_param("ii", $userId, $commentId);
    $stmt->execute();
    $stmt->close();

    $liked = true;

}

elseif ($existing["deleted_at"] === null) {

    $stmt = $conn->prepare("UPDATE likes SET deleted_at = NOW() WHERE id = ?");

    $stmt->bind_param("i", $existing["id"]);
    $stmt->execute();
    $stmt->close();

    $liked = false;

}

else {

    $stmt = $conn->prepare(
        "UPDATE likes SET deleted_at = NULL, updated_at = NOW() WHERE id = ?"
    );

    $stmt->bind_param("i", $existing["id"]);
    $stmt->execute();
    $stmt->close();

    $liked = true;

}


// Notification (the comment id rides in the post_id column
// so unlike removes exactly the right one)

if ($liked) {

    removeNotification($conn, $author, $userId, "comment_like", $commentId);

    addNotification($conn, $author, $userId, "comment_like", $commentId);

} else {

    removeNotification($conn, $author, $userId, "comment_like", $commentId);

}


// Fresh count

$stmt = $conn->prepare(
    "SELECT COUNT(*) AS total
     FROM likes
     WHERE content_type = 'comment' AND content_id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $commentId);
$stmt->execute();

$count = $stmt->get_result()->fetch_assoc()["total"];

$stmt->close();


echo json_encode([
    "liked" => $liked,
    "count" => (int)$count
]);