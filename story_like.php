<?php

session_start();

require_once "includes/functions.php";

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


// The story must exist and still be active (24h)

$stmt = $conn->prepare(
    "SELECT user_id FROM stories
     WHERE id = ? AND created_at > NOW() - INTERVAL 24 HOUR"
);

$stmt->bind_param("i", $storyId);
$stmt->execute();

$story = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$story) {

    http_response_code(404);
    echo json_encode(["error" => "Story not found."]);
    exit;

}


$storyOwner = (int)$story["user_id"];


if ($storyOwner === $userId) {

    http_response_code(400);
    echo json_encode(["error" => "You cannot like your own story."]);
    exit;

}


// Same toggle pattern as post likes — just content_type = 'story'.
// This is why the likes table had a content_type column all along!

$stmt = $conn->prepare(
    "SELECT id, deleted_at
     FROM likes
     WHERE user_id = ? AND content_type = 'story' AND content_id = ?"
);

$stmt->bind_param("ii", $userId, $storyId);
$stmt->execute();

$existing = $stmt->get_result()->fetch_assoc();

$stmt->close();


if ($existing === null) {

    $stmt = $conn->prepare(
        "INSERT INTO likes (user_id, content_type, content_id, status)
         VALUES (?, 'story', ?, 0)"
    );

    $stmt->bind_param("ii", $userId, $storyId);
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


// Notification for the story owner
// (the story id rides in the post_id column — it's just an int)

if ($liked) {

    removeNotification($conn, $storyOwner, $userId, "story_like", $storyId);

    addNotification($conn, $storyOwner, $userId, "story_like", $storyId);

} else {

    removeNotification($conn, $storyOwner, $userId, "story_like", $storyId);

}


echo json_encode(["liked" => $liked]);