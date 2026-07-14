<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];
$error  = "";


// Flash error from a failed story upload

$storyError = $_SESSION["story_error"] ?? "";

unset($_SESSION["story_error"]);


// Handle new post (text + optional photo OR video)

if ($_SERVER["REQUEST_METHOD"] === "POST") {


    $content = trim($_POST["content"] ?? "");

    $image = validateImage($_FILES["photo"] ?? null);
    $video = validateVideo($_FILES["video"] ?? null);


    if (is_array($image) && isset($image["error"])) {

        $error = $image["error"];

    }

    elseif (is_array($video) && isset($video["error"])) {

        $error = $video["error"];

    }

    elseif ($content === "" && $image === null && $video === null) {

        $error = "Write something or add a photo or video.";

    }

    elseif (mb_strlen($content) > 1000) {

        $error = "Post is too long (max 1000 characters).";

    }

    else {


        // Insert the post WITH the media bytes inside the row.
        // Blob params are bound as null and streamed with sendBlob.

        $imgMime = $image["mime"] ?? null;
        $vidMime = $video["mime"] ?? null;

        $null = null;


        $stmt = $conn->prepare(
            "INSERT INTO posts
             (user_id, content, image_mime, image_data, video_mime, video_data, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, NOW())"
        );

        $stmt->bind_param("issbsb", $userId, $content, $imgMime, $null, $vidMime, $null);


        if ($image !== null) {
            sendBlob($stmt, 3, $image["tmp"]);   // 4th param (zero-based index 3)
        }

        if ($video !== null) {
            sendBlob($stmt, 5, $video["tmp"]);   // 6th param
        }


        $stmt->execute();

        $postId = $stmt->insert_id;

        $stmt->close();


        // Pull #hashtags out of the content and link them to this post

        syncPostHashtags($conn, $postId, $content);


        // Point the display columns at the blob in this same row,
        // so renderPost and the feed queries work unchanged.

        if ($image !== null || $video !== null) {

            $imageUrl = ($image !== null) ? "media.php?t=pi&id=" . $postId : null;
            $videoUrl = ($video !== null) ? "media.php?t=pv&id=" . $postId : null;

            $stmt = $conn->prepare(
                "UPDATE posts SET image = ?, video = ? WHERE id = ?"
            );

            $stmt->bind_param("ssi", $imageUrl, $videoUrl, $postId);
            $stmt->execute();
            $stmt->close();

        }


        header("Location: home.php");
        exit;

    }

}


// Story bar: me + people I follow with stories from the last 24 hours

$stmt = $conn->prepare(
    "SELECT u.id, u.username, u.firstname, u.lastname, u.avatar,
            MAX(s.created_at) AS latest,
            SUM(CASE WHEN v.id IS NULL THEN 1 ELSE 0 END) AS unseen

     FROM stories s

     JOIN users u ON u.id = s.user_id

     LEFT JOIN story_views v
            ON v.story_id = s.id AND v.user_id = ?

     WHERE s.created_at > NOW() - INTERVAL 24 HOUR
       AND u.deleted_at IS NULL
       AND (s.user_id = ?
            OR s.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))

     GROUP BY u.id, u.username, u.firstname, u.lastname, u.avatar
     ORDER BY (u.id = ?) DESC, unseen DESC, latest DESC"
);

$stmt->bind_param("iiii", $userId, $userId, $userId, $userId);
$stmt->execute();

$storyUsers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


// Split out MY story entry (renders differently, with the + button)

$myStory = null;

foreach ($storyUsers as $i => $su) {

    if ((int)$su["id"] === (int)$userId) {

        $myStory = $su;

        unset($storyUsers[$i]);

        break;

    }

}


// Which feed tab? "all" (For You) or "following"

$feed = ($_GET["feed"] ?? "all") === "following" ? "following" : "all";


// Base feed query

$sql =
    "SELECT p.id, p.user_id, p.content, p.image, p.video, p.created_at, p.updated_at,
            u.username, u.firstname, u.lastname, u.avatar,

            (SELECT COUNT(*) FROM likes l
             WHERE l.content_type = 'post' AND l.content_id = p.id
               AND l.deleted_at IS NULL) AS like_count,

            (SELECT COUNT(*) FROM likes l
             WHERE l.content_type = 'post' AND l.content_id = p.id
               AND l.user_id = ? AND l.deleted_at IS NULL) AS liked_by_me

     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.deleted_at IS NULL";


if ($feed === "following") {

    $sql .= " AND p.user_id IN
              (SELECT following_id FROM follows WHERE follower_id = ?)";

}


$sql .= " ORDER BY p.created_at DESC LIMIT 50";


$stmt = $conn->prepare($sql);


if ($feed === "following") {
    $stmt->bind_param("ii", $userId, $userId);
} else {
    $stmt->bind_param("i", $userId);
}


$stmt->execute();

$posts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


$comments = fetchCommentsGrouped($conn, $userId);


// "People you may know" — friends of friends first

$suggestions = [];

if ($feed === "all") {


    $stmt = $conn->prepare(
        "SELECT u.id, u.username, u.firstname, u.lastname, u.avatar,

                (SELECT COUNT(*) FROM follows f
                 WHERE f.following_id = u.id) AS followers,

                (SELECT COUNT(*) FROM follows f
                 WHERE f.following_id = u.id
                   AND f.follower_id IN
                       (SELECT following_id FROM follows WHERE follower_id = ?)
                ) AS mutuals

         FROM users u
         WHERE u.id != ?
           AND u.deleted_at IS NULL
           AND u.id NOT IN
               (SELECT following_id FROM follows WHERE follower_id = ?)
         ORDER BY mutuals DESC, followers DESC, u.created_at DESC
         LIMIT 6"
    );

    $stmt->bind_param("iii", $userId, $userId, $userId);
    $stmt->execute();

    $suggestions = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $stmt->close();

}


$pageTitle = "Home";

require_once "includes/header.php";

?>

<main class="feed">

    <!-- Stories -->

    <div class="card stories-card">

        <?php if ($storyError): ?>

            <div class="composer-error"><?= htmlspecialchars($storyError); ?></div>

        <?php endif; ?>

        <div class="stories-bar">

            <!-- Your story -->

            <div class="story-item">

                <?php if ($myStory): ?>

                    <a href="story.php?user=<?= $userId; ?>" class="story-ring active">
                        <?= avatarHtml($navUser["avatar"], $navUser["firstname"], $navUser["lastname"], "story"); ?>
                    </a>

                <?php else: ?>

                    <button type="button" class="story-ring none" data-open-story-upload>
                        <?= avatarHtml($navUser["avatar"], $navUser["firstname"], $navUser["lastname"], "story"); ?>
                    </button>

                <?php endif; ?>

                <button type="button" class="story-add" data-open-story-upload title="Add to your story">+</button>

                <span class="story-name">Your story</span>

            </div>


            <!-- People you follow -->

            <?php foreach ($storyUsers as $su): ?>

                <div class="story-item">

                    <a href="story.php?user=<?= $su["id"]; ?>"
                       class="story-ring <?= $su["unseen"] > 0 ? "active" : "seen"; ?>">

                        <?= avatarHtml($su["avatar"], $su["firstname"], $su["lastname"], "story"); ?>

                    </a>

                    <span class="story-name"><?= htmlspecialchars($su["username"]); ?></span>

                </div>

            <?php endforeach; ?>

        </div>

        <!-- Hidden upload form: stories can be photos OR videos now -->

        <form id="storyForm" method="POST" action="story_upload.php"
              enctype="multipart/form-data" hidden>

            <input type="file" name="story" id="storyInput"
                   accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime">

        </form>

    </div>


    <!-- Create post -->

    <div class="card composer">

        <?php if ($error): ?>

            <div class="composer-error"><?= htmlspecialchars($error); ?></div>

        <?php endif; ?>

        <form method="POST" id="postForm" enctype="multipart/form-data">

            <textarea
                name="content"
                id="postContent"
                placeholder="What's on your mind, <?= htmlspecialchars($_SESSION["firstname"] ?? $_SESSION["username"]); ?>?"
                maxlength="1000"
                rows="3"
            ></textarea>

            <!-- Photo preview -->

            <div class="photo-preview" hidden>

                <img id="previewImg" src="" alt="Preview">

                <button type="button" id="removePhoto" title="Remove photo">✕</button>

            </div>

            <!-- Video preview -->

            <div class="video-preview" hidden>

                <video id="previewVideo" controls></video>

                <button type="button" id="removeVideo" title="Remove video">✕</button>

            </div>

            <div class="composer-footer">

                <label class="photoBtn" title="Add a photo">

                    📷 Photo

                    <input type="file" name="photo" id="photoInput"
                           accept="image/jpeg,image/png,image/gif,image/webp" hidden>

                </label>

                <label class="photoBtn" title="Add a video">

                    🎬 Video

                    <input type="file" name="video" id="videoInput"
                           accept="video/mp4,video/webm,video/quicktime" hidden>

                </label>

                <button type="button" class="photoBtn" id="cameraBtn"
                        title="Take a photo with your camera">
                    📸 Camera
                </button>

                <!-- Fallback: opens the device's native camera app.
                     No name attribute — it never submits itself; JS moves
                     the photo into the normal photo input. -->

                <input type="file" id="nativeCameraInput"
                       accept="image/*" capture="environment" hidden>

                <button type="button" class="photoBtn" id="aiBtn"
                        title="Let AI write a post for you">
                    ✨ AI
                </button>

                <span class="charCount">0 / 1000</span>

                <button type="submit" class="submitBtn" id="postBtn" disabled>
                    Post
                </button>

            </div>

        </form>

    </div>


    <!-- People you may know -->

    <?php if (count($suggestions) > 0): ?>

        <div class="card suggestions-card">

            <h3 class="suggestions-title">People you may know</h3>

            <div class="suggestions">

                <?php foreach ($suggestions as $s): ?>

                    <div class="suggestion">

                        <a href="profile.php?id=<?= $s["id"]; ?>">
                            <?= avatarHtml($s["avatar"], $s["firstname"], $s["lastname"], "big"); ?>
                        </a>

                        <a class="suggestion-name" href="profile.php?id=<?= $s["id"]; ?>">
                            <?= htmlspecialchars($s["firstname"] . " " . $s["lastname"]); ?>
                        </a>

                        <span class="suggestion-info">

                            <?php if ($s["mutuals"] > 0): ?>

                                Followed by <?= $s["mutuals"]; ?> you follow

                            <?php else: ?>

                                <?= $s["followers"]; ?> followers

                            <?php endif; ?>

                        </span>

                        <button class="submitBtn small followBtn" data-user-id="<?= $s["id"]; ?>">
                            Follow
                        </button>

                    </div>

                <?php endforeach; ?>

            </div>

        </div>

    <?php endif; ?>


    <!-- Feed tabs -->

    <div class="feed-tabs">

        <a href="home.php" class="<?= $feed === "all" ? "active" : ""; ?>">
            For You
        </a>

        <a href="home.php?feed=following" class="<?= $feed === "following" ? "active" : ""; ?>">
            Following
        </a>

    </div>


    <?php if (count($posts) === 0): ?>

        <div class="card empty">

            <?php if ($feed === "following"): ?>

                <h2>Nothing here yet</h2>
                <p>Follow some people and their posts will show up here. Try the search bar above!</p>

            <?php else: ?>

                <h2>No posts yet</h2>
                <p>Write the first post and start the conversation.</p>

            <?php endif; ?>

        </div>

    <?php endif; ?>


    <?php foreach ($posts as $post): ?>

        <?php renderPost($post, $comments[$post["id"]] ?? [], $userId); ?>

    <?php endforeach; ?>

</main>

<script>
    const CURRENT_USER = {
        firstname: <?= json_encode($_SESSION["firstname"] ?? $_SESSION["username"]); ?>,
        lastname:  <?= json_encode($_SESSION["lastname"] ?? ""); ?>,
        avatar:    <?= json_encode($navUser["avatar"] ?? null); ?>
    };
</script>

<script src="assets/app.js"></script>

</body>
</html>