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
$targetId = (int)($_POST["user_id"] ?? 0);


if ($targetId <= 0) {

    http_response_code(400);
    echo json_encode(["error" => "Invalid user."]);
    exit;

}


if ($targetId === $userId) {

    http_response_code(400);
    echo json_encode(["error" => "You cannot follow yourself."]);
    exit;

}


// Make sure the target user exists

$stmt = $conn->prepare(
    "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $targetId);
$stmt->execute();

if ($stmt->get_result()->num_rows === 0) {

    http_response_code(404);
    echo json_encode(["error" => "User not found."]);
    exit;

}

$stmt->close();


// Already following?

$stmt = $conn->prepare(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?"
);

$stmt->bind_param("ii", $userId, $targetId);
$stmt->execute();

$existing = $stmt->get_result()->fetch_assoc();

$stmt->close();


if ($existing) {

    // Unfollow

    $stmt = $conn->prepare("DELETE FROM follows WHERE id = ?");
    $stmt->bind_param("i", $existing["id"]);
    $stmt->execute();
    $stmt->close();

    $following = false;


    // Remove the "started following you" notification

    removeNotification($conn, $targetId, $userId, "follow");

} else {

    // Follow

    $stmt = $conn->prepare(
        "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)"
    );

    $stmt->bind_param("ii", $userId, $targetId);
    $stmt->execute();
    $stmt->close();

    $following = true;


    // Notify them

    removeNotification($conn, $targetId, $userId, "follow");

    addNotification($conn, $targetId, $userId, "follow");

}


// Fresh follower count for the target user

$stmt = $conn->prepare(
    "SELECT COUNT(*) AS total FROM follows WHERE following_id = ?"
);

$stmt->bind_param("i", $targetId);
$stmt->execute();

$count = $stmt->get_result()->fetch_assoc()["total"];

$stmt->close();


echo json_encode([
    "following" => $following,
    "followers" => (int)$count
]);