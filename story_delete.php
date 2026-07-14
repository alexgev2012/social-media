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
$storyId = (int)($_POST["story_id"] ?? 0);


if ($storyId <= 0) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid story."]);
    exit;

}


/*
 * Hard delete, but ONLY my own story.
 *
 * Stories are ephemeral (they expire anyway), so unlike posts we
 * don't soft-delete. And since the media bytes live INSIDE the
 * stories row, deleting the row deletes the photo/video with it —
 * nothing left behind.
 */

$stmt = $conn->prepare(
    "DELETE FROM stories WHERE id = ? AND user_id = ?"
);

$stmt->bind_param("ii", $storyId, $userId);

$stmt->execute();


if ($stmt->affected_rows === 0) {

    http_response_code(403);
    echo json_encode(["error" => "You can only delete your own stories."]);
    exit;

}

$stmt->close();


// Clean up everything that pointed at this story

$stmt = $conn->prepare("DELETE FROM story_views WHERE story_id = ?");
$stmt->bind_param("i", $storyId);
$stmt->execute();
$stmt->close();


$stmt = $conn->prepare(
    "DELETE FROM likes WHERE content_type = 'story' AND content_id = ?"
);
$stmt->bind_param("i", $storyId);
$stmt->execute();
$stmt->close();


$stmt = $conn->prepare(
    "DELETE FROM notifications WHERE type = 'story_like' AND post_id = ?"
);
$stmt->bind_param("i", $storyId);
$stmt->execute();
$stmt->close();


echo json_encode(["success" => true]);