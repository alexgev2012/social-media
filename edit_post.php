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


// First check: does this post exist AND belong to me?
// (Checking ownership with a SELECT instead of affected_rows,
//  because affected_rows is also 0 when the content didn't change.)

$stmt = $conn->prepare(
    "SELECT id FROM posts
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("ii", $postId, $userId);
$stmt->execute();

$isMine = $stmt->get_result()->num_rows === 1;

$stmt->close();


if (!$isMine) {

    http_response_code(403);
    echo json_encode(["error" => "You can only edit your own posts."]);
    exit;

}


// Now update

$stmt = $conn->prepare(
    "UPDATE posts
     SET content = ?, updated_at = NOW()
     WHERE id = ?"
);

$stmt->bind_param("si", $content, $postId);

$stmt->execute();

$stmt->close();


// Content changed → re-sync which hashtags this post is linked to

require_once "includes/functions.php";

syncPostHashtags($conn, $postId, $content);


echo json_encode([
    "success" => true,
    "content" => $content
]);