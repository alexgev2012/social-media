<?php

session_start();

require_once "includes/functions.php";

header("Content-Type: application/json");


if (!isset($_SESSION["user_id"])) {

    http_response_code(401);
    echo json_encode(["error" => "Not logged in."]);
    exit;

}


$userId   = (int)$_SESSION["user_id"];
$postId   = (int)($_POST["post_id"] ?? 0);
$parentId = (int)($_POST["parent_id"] ?? 0);
$content  = trim($_POST["content"] ?? "");


if ($postId <= 0) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid post."]);
    exit;

}


if ($content === "") {

    http_response_code(400);
    echo json_encode(["error" => "Comment cannot be empty."]);
    exit;

}


if (mb_strlen($content) > 500) {

    http_response_code(400);
    echo json_encode(["error" => "Comment is too long (max 500 characters)."]);
    exit;

}


// The post must exist — grab its owner for the notification

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


/*
 * If this is a REPLY: validate the parent comment.
 * We keep threads one level deep (like Instagram): replying to a
 * reply attaches to the top-level comment instead — but the
 * notification still goes to the person actually replied to.
 */

$replyTarget = null;


if ($parentId > 0) {


    $stmt = $conn->prepare(
        "SELECT id, parent_id, user_id, post_id
         FROM comments
         WHERE id = ? AND deleted_at IS NULL"
    );

    $stmt->bind_param("i", $parentId);
    $stmt->execute();

    $parent = $stmt->get_result()->fetch_assoc();

    $stmt->close();


    if (!$parent || (int)$parent["post_id"] !== $postId) {

        http_response_code(404);
        echo json_encode(["error" => "Comment not found."]);
        exit;

    }


    $replyTarget = (int)$parent["user_id"];


    // Replying to a reply → attach to its top-level parent

    if (!empty($parent["parent_id"])) {

        $parentId = (int)$parent["parent_id"];

    }

}


// Insert
// Note: post_id and user_id are TEXT columns in the schema

$postIdStr = (string)$postId;
$userIdStr = (string)$userId;

$parentOrNull = ($parentId > 0) ? $parentId : null;


$stmt = $conn->prepare(
    "INSERT INTO comments (post_id, user_id, status, content, parent_id)
     VALUES (?, ?, 0, ?, ?)"
);

$stmt->bind_param("sssi", $postIdStr, $userIdStr, $content, $parentOrNull);

$stmt->execute();

$commentId = $stmt->insert_id;

$stmt->close();


/*
 * Notifications:
 *  - reply       → the person being replied to
 *  - comment     → the post owner (unless they ARE the reply target,
 *                  so nobody gets notified twice for one action)
 * addNotification skips self-notifications automatically.
 */

if ($replyTarget !== null) {

    addNotification($conn, $replyTarget, $userId, "reply", $postId);

    if ($postOwner !== $replyTarget) {

        addNotification($conn, $postOwner, $userId, "comment", $postId);

    }

} else {

    addNotification($conn, $postOwner, $userId, "comment", $postId);

}


echo json_encode([
    "success"   => true,
    "id"        => $commentId,
    "parent_id" => $parentOrNull,
    "content"   => $content
]);