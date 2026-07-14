<?php

session_start();

require_once "includes/functions.php";

header("Content-Type: application/json");


if (!isset($_SESSION["user_id"])) {

    http_response_code(401);
    echo json_encode(["error" => "Not logged in."]);
    exit;

}


$userId = $_SESSION["user_id"];
$postId = (int)($_POST["post_id"] ?? 0);


if ($postId <= 0) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid post."]);
    exit;

}


// Make sure the post exists — and grab its owner for the notification

$stmt = $conn->prepare(
    "SELECT id, user_id FROM posts WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $postId);
$stmt->execute();

$post = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$post) {

    http_response_code(404);
    echo json_encode(["error" => "Post not found."]);
    exit;

}


$postOwner = (int)$post["user_id"];


// Do I already have a like row for this post?

$stmt = $conn->prepare(
    "SELECT id, deleted_at
     FROM likes
     WHERE user_id = ? AND content_type = 'post' AND content_id = ?"
);

$stmt->bind_param("ii", $userId, $postId);
$stmt->execute();

$existing = $stmt->get_result()->fetch_assoc();

$stmt->close();


if ($existing === null) {

    // First time liking → insert

    $stmt = $conn->prepare(
        "INSERT INTO likes (user_id, content_type, content_id, status)
         VALUES (?, 'post', ?, 0)"
    );

    $stmt->bind_param("ii", $userId, $postId);
    $stmt->execute();
    $stmt->close();

    $liked = true;

}

elseif ($existing["deleted_at"] === null) {

    // Currently liked → unlike (soft delete)

    $stmt = $conn->prepare(
        "UPDATE likes SET deleted_at = NOW() WHERE id = ?"
    );

    $stmt->bind_param("i", $existing["id"]);
    $stmt->execute();
    $stmt->close();

    $liked = false;

}

else {

    // Was unliked before → like again (restore)

    $stmt = $conn->prepare(
        "UPDATE likes SET deleted_at = NULL, updated_at = NOW() WHERE id = ?"
    );

    $stmt->bind_param("i", $existing["id"]);
    $stmt->execute();
    $stmt->close();

    $liked = true;

}


// Notification: add on like, remove on unlike
// (addNotification skips it automatically if I liked my own post)

if ($liked) {

    // Remove any old one first so re-liking doesn't create duplicates

    removeNotification($conn, $postOwner, $userId, "like", $postId);

    addNotification($conn, $postOwner, $userId, "like", $postId);

} else {

    removeNotification($conn, $postOwner, $userId, "like", $postId);

}


// Return the fresh like count

$stmt = $conn->prepare(
    "SELECT COUNT(*) AS total
     FROM likes
     WHERE content_type = 'post' AND content_id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $postId);
$stmt->execute();

$count = $stmt->get_result()->fetch_assoc()["total"];

$stmt->close();


echo json_encode([
    "liked" => $liked,
    "count" => (int)$count
]);