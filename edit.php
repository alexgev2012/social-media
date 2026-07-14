<?php

session_start();

require_once "includes/database.php";

header("Content-Type: application/json");


if (!isset($_SESSION["user_id"])) {

    http_response_code(401);
    echo json_encode(["error" => "Not logged in."]);
    exit;

}


$userId  = (int)$_SESSION["user_id"];
$postId  = (int)($_POST["post_id"] ?? 0);
$content = trim($_POST["content"] ?? "");


if ($postId <= 0) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid post."]);
    exit;

}


if ($content === "") {

    http_response_code(400);
    echo json_encode(["error" => "Post cannot be empty."]);
    exit;

}


if (mb_strlen($content) > 1000) {

    http_response_code(400);
    echo json_encode(["error" => "Post is too long (max 1000 characters)."]);
    exit;

}


// Update, but ONLY my own post

$stmt = $conn->prepare(
    "UPDATE posts
     SET content = ?, updated_at = NOW()
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("sii", $content, $postId, $userId);

$stmt->execute();


if ($stmt->affected_rows === 0) {

    http_response_code(403);
    echo json_encode(["error" => "You can only edit your own posts."]);
    exit;

}

$stmt->close();


echo json_encode([
    "success" => true,
    "content" => $content
]);