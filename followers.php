<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];


// Whose list are we looking at?

$profileId = (int)($_GET["id"] ?? $userId);

// Which tab: "followers" (people who follow them) or "following" (people they follow)

$tab = ($_GET["tab"] ?? "followers") === "following" ? "following" : "followers";


// Load the profile user (for the title)

$stmt = $conn->prepare(
    "SELECT id, username, firstname, lastname
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


// Counts for the tab labels

$stmt = $conn->prepare(
    "SELECT
        (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following"
);

$stmt->bind_param("ii", $profileId, $profileId);
$stmt->execute();

$counts = $stmt->get_result()->fetch_assoc();

$stmt->close();


/*
 * The list itself.
 *
 * followers tab:  people where f.following_id = profile  → show f.follower_id
 * following tab:  people where f.follower_id = profile   → show f.following_id
 */

if ($tab === "followers") {

    $sql =
        "SELECT u.id, u.username, u.firstname, u.lastname, u.avatar,

                (SELECT COUNT(*) FROM follows f2
                 WHERE f2.following_id = u.id) AS followers,

                (SELECT COUNT(*) FROM follows f2
                 WHERE f2.follower_id = ? AND f2.following_id = u.id) AS followed_by_me

         FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ? AND u.deleted_at IS NULL
         ORDER BY f.created_at DESC";

} else {

    $sql =
        "SELECT u.id, u.username, u.firstname, u.lastname, u.avatar,

                (SELECT COUNT(*) FROM follows f2
                 WHERE f2.following_id = u.id) AS followers,

                (SELECT COUNT(*) FROM follows f2
                 WHERE f2.follower_id = ? AND f2.following_id = u.id) AS followed_by_me

         FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ? AND u.deleted_at IS NULL
         ORDER BY f.created_at DESC";

}


$stmt = $conn->prepare($sql);

$stmt->bind_param("ii", $userId, $profileId);
$stmt->execute();

$people = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


$pageTitle = $profile["firstname"] . " " . $profile["lastname"];

require_once "includes/header.php";

?>

<main class="feed">

    <!-- Back to profile -->

    <a href="profile.php?id=<?= $profile["id"]; ?>" class="back-link">
        ← Back to <?= htmlspecialchars($profile["firstname"]); ?>'s profile
    </a>


    <!-- Tabs -->

    <div class="feed-tabs">

        <a href="followers.php?id=<?= $profile["id"]; ?>&tab=followers"
           class="<?= $tab === "followers" ? "active" : ""; ?>">

            Followers (<?= $counts["followers"]; ?>)

        </a>

        <a href="followers.php?id=<?= $profile["id"]; ?>&tab=following"
           class="<?= $tab === "following" ? "active" : ""; ?>">

            Following (<?= $counts["following"]; ?>)

        </a>

    </div>


    <div class="card">

        <?php if (count($people) === 0): ?>

            <p class="muted">

                <?= $tab === "followers"
                    ? "No followers yet."
                    : "Not following anyone yet."; ?>

            </p>

        <?php endif; ?>

        <div class="user-list">

            <?php foreach ($people as $u): ?>

                <div class="user-row">

                    <a href="profile.php?id=<?= $u["id"]; ?>">
                        <?= avatarHtml($u["avatar"], $u["firstname"], $u["lastname"]); ?>
                    </a>

                    <div class="user-row-info">

                        <a class="user-row-name" href="profile.php?id=<?= $u["id"]; ?>">
                            <?= htmlspecialchars($u["firstname"] . " " . $u["lastname"]); ?>
                        </a>

                        <span class="muted">
                            @<?= htmlspecialchars($u["username"]); ?>
                            · <?= $u["followers"]; ?> followers
                        </span>

                    </div>

                    <?php if ((int)$u["id"] === (int)$userId): ?>

                        <span class="muted">You</span>

                    <?php else: ?>

                        <button
                            class="submitBtn small followBtn <?= $u["followed_by_me"] ? "following" : ""; ?>"
                            data-user-id="<?= $u["id"]; ?>">

                            <?= $u["followed_by_me"] ? "Following" : "Follow"; ?>

                        </button>

                    <?php endif; ?>

                </div>

            <?php endforeach; ?>

        </div>

    </div>

</main>

<script src="assets/app.js"></script>

</body>
</html>