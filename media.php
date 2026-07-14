<?php

/*
 * media.php — serves photos and videos stored inside the tables.
 *
 * URL format:  media.php?t=TYPE&id=ROW_ID
 *
 *   t=pi → posts.image_data      t=pv → posts.video_data
 *   t=si → stories.image_data    t=sv → stories.video_data
 *   t=av → users.avatar_data
 *
 * The type is mapped through a WHITELIST below — the table and
 * column names never come from the user, only the row id does
 * (and that is bound as a parameter). Never build SQL identifiers
 * from user input directly.
 */

session_start();

require_once "includes/database.php";


// Only logged-in users can load media

if (!isset($_SESSION["user_id"])) {

    http_response_code(403);
    exit;

}


$type = $_GET["t"] ?? "";
$id   = (int)($_GET["id"] ?? 0);


if ($id <= 0) {

    http_response_code(404);
    exit;

}


// Whitelist: type → [table, data column, mime column]

$map = [
    "pi" => ["posts",   "image_data",  "image_mime"],
    "pv" => ["posts",   "video_data",  "video_mime"],
    "si" => ["stories", "image_data",  "image_mime"],
    "sv" => ["stories", "video_data",  "video_mime"],
    "av" => ["users",   "avatar_data", "avatar_mime"]
];


if (isset($map[$type])) {

    [$table, $dataCol, $mimeCol] = $map[$type];

    $stmt = $conn->prepare(
        "SELECT `$mimeCol` AS mime, `$dataCol` AS data FROM `$table` WHERE id = ?"
    );

}

else {

    // Legacy fallback: v8 stored media in a separate `media` table
    // as media.php?id=N (no type). Keep those URLs working.

    $stmt = $conn->prepare(
        "SELECT mime, data FROM media WHERE id = ?"
    );

}


$stmt->bind_param("i", $id);
$stmt->execute();

$media = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$media || $media["data"] === null) {

    http_response_code(404);
    exit;

}


$data = $media["data"];
$size = strlen($data);


header("Content-Type: " . $media["mime"]);
header("Cache-Control: public, max-age=31536000, immutable");
header("Accept-Ranges: bytes");


/*
 * Range requests: the browser asks for a PIECE of the file,
 * e.g. "Range: bytes=1000000-" when you jump to the middle of
 * a video. Without this, video seeking doesn't work.
 */

if (isset($_SERVER["HTTP_RANGE"]) &&
    preg_match('/bytes=(\d*)-(\d*)/', $_SERVER["HTTP_RANGE"], $m)) {


    $start = ($m[1] !== "") ? (int)$m[1] : 0;
    $end   = ($m[2] !== "") ? (int)$m[2] : $size - 1;


    if ($start > $end || $start >= $size) {

        http_response_code(416);
        header("Content-Range: bytes */" . $size);
        exit;

    }

    if ($end >= $size) {
        $end = $size - 1;
    }


    http_response_code(206);

    header("Content-Range: bytes " . $start . "-" . $end . "/" . $size);
    header("Content-Length: " . ($end - $start + 1));

    echo substr($data, $start, $end - $start + 1);

    exit;

}


header("Content-Length: " . $size);

echo $data;