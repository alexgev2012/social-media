<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];


if ($_SERVER["REQUEST_METHOD"] === "POST") {


    $file = $_FILES["story"] ?? null;


    if (!$file || $file["error"] === UPLOAD_ERR_NO_FILE) {

        $_SESSION["story_error"] = "Please choose a photo or video for your story.";

        header("Location: home.php");
        exit;

    }


    // Photo or video? Check the REAL mime type first.

    $isVideo = false;

    if ($file["error"] === UPLOAD_ERR_OK) {

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($file["tmp_name"]);

        $isVideo = str_starts_with((string)$mime, "video/");

    }


    $media = $isVideo ? validateVideo($file) : validateImage($file);


    if ($media === null || isset($media["error"])) {

        $_SESSION["story_error"] = $media["error"] ?? "Upload failed. Please try again.";

    }

    else {


        // Insert the story with the bytes inside the row.
        // One of the two blob columns stays NULL.

        $imgMime = $isVideo ? null : $media["mime"];
        $vidMime = $isVideo ? $media["mime"] : null;

        $null = null;


        $stmt = $conn->prepare(
            "INSERT INTO stories (user_id, image_mime, image_data, video_mime, video_data)
             VALUES (?, ?, ?, ?, ?)"
        );

        $stmt->bind_param("isbsb", $userId, $imgMime, $null, $vidMime, $null);


        sendBlob($stmt, $isVideo ? 4 : 2, $media["tmp"]);


        $stmt->execute();

        $storyId = $stmt->insert_id;

        $stmt->close();


        // Point the display column at the blob in this row

        $imageUrl = $isVideo ? null : "media.php?t=si&id=" . $storyId;
        $videoUrl = $isVideo ? "media.php?t=sv&id=" . $storyId : null;


        $stmt = $conn->prepare(
            "UPDATE stories SET image = ?, video = ? WHERE id = ?"
        );

        $stmt->bind_param("ssi", $imageUrl, $videoUrl, $storyId);
        $stmt->execute();
        $stmt->close();

    }

}


header("Location: home.php");
exit;