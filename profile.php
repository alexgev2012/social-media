<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];


// Whose profile? ?id=... or my own

$profileId = (int)($_GET["id"] ?? $userId);


// Load the profile user

$stmt = $conn->prepare(
    "SELECT id, username, firstname, lastname, avatar, bio, created_at
     FROM users
     WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $profileId);
$stmt->execute();

$profile = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$profile) {

    http_response_code(404);
    die("User not found. <a href='home.php'>Back to home</a>");

}


$isOwnProfile = $profileId === (int)$userId;


// Stats: posts, followers, following

$stmt = $conn->prepare(
    "SELECT
        (SELECT COUNT(*) FROM posts
         WHERE user_id = ? AND deleted_at IS NULL) AS post_count,

        (SELECT COUNT(*) FROM follows
         WHERE following_id = ?) AS followers,

        (SELECT COUNT(*) FROM follows
         WHERE follower_id = ?) AS following,

        (SELECT COUNT(*) FROM follows
         WHERE follower_id = ? AND following_id = ?) AS followed_by_me"
);

$stmt->bind_param("iiiii", $profileId, $profileId, $profileId, $userId, $profileId);
$stmt->execute();

$stats = $stmt->get_result()->fetch_assoc();

$stmt->close();


// This user's posts

$stmt = $conn->prepare(
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
     WHERE p.user_id = ? AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC"
);

$stmt->bind_param("ii", $userId, $profileId);
$stmt->execute();

$posts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


$comments = fetchCommentsGrouped($conn, $userId);


$pageTitle = $profile["firstname"] . " " . $profile["lastname"];

require_once "includes/header.php";

?>

<main class="feed">

    <!-- Profile card -->

    <div class="card profile-card">

        <div class="profile-cover"></div>

        <div class="profile-body">

            <div class="profile-avatar">
                <?= avatarHtml($profile["avatar"], $profile["firstname"], $profile["lastname"], "big"); ?>
            </div>

            <div class="profile-top">

                <div>

                    <h1><?= htmlspecialchars($profile["firstname"] . " " . $profile["lastname"]); ?></h1>

                    <span class="profile-username">@<?= htmlspecialchars($profile["username"]); ?></span>

                </div>

                <?php if ($isOwnProfile): ?>

                    <a href="edit_profile.php" class="outlineBtn">Edit profile</a>

                <?php else: ?>

                    <div class="profile-btns">

                        <a href="chat.php?user=<?= $profile["id"]; ?>" class="outlineBtn">
                            Message
                        </a>

                        <button
                            class="submitBtn followBtn <?= $stats["followed_by_me"] ? "following" : ""; ?>"
                            data-user-id="<?= $profile["id"]; ?>">

                            <?= $stats["followed_by_me"] ? "Following" : "Follow"; ?>

                        </button>

                    </div>

                <?php endif; ?>

            </div>

            <?php if (!empty($profile["bio"])): ?>

                <p class="profile-bio"><?= nl2br(htmlspecialchars($profile["bio"])); ?></p>

            <?php endif; ?>

            <div class="profile-stats">

                <span><strong><?= $stats["post_count"]; ?></strong> posts</span>

                <a href="followers.php?id=<?= $profile["id"]; ?>&tab=followers">
                    <strong class="followerCount"><?= $stats["followers"]; ?></strong> followers
                </a>

                <a href="followers.php?id=<?= $profile["id"]; ?>&tab=following">
                    <strong><?= $stats["following"]; ?></strong> following
                </a>

                <span class="profile-joined">
                    Joined <?= date("M Y", strtotime($profile["created_at"])); ?>
                </span>

            </div>

        </div>

    </div>


    <!-- Posts -->

    <?php if (count($posts) === 0): ?>

        <div class="card empty">

            <h2>No posts yet</h2>

            <p>
                <?= $isOwnProfile
                    ? "Share your first post from the home page."
                    : htmlspecialchars($profile["firstname"]) . " hasn't posted anything yet."; ?>
            </p>

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