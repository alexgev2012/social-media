<?php

session_start();

require_once "includes/database.php";

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


// Soft delete, but ONLY if the post belongs to me
// (user_id check prevents deleting other people's posts)

$stmt = $conn->prepare(
    "UPDATE posts
     SET deleted_at = NOW()
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("ii", $postId, $userId);

$stmt->execute();


if ($stmt->affected_rows === 0) {

    http_response_code(403);
    echo json_encode(["error" => "You can only delete your own posts."]);
    exit;

}

$stmt->close();


echo json_encode(["success" => true]);