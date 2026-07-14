<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = $_SESSION["user_id"];

$q = trim($_GET["q"] ?? "");

$results = [];


if ($q !== "") {


    // Search by username, first name, last name, or full name

    $like = "%" . $q . "%";


    $stmt = $conn->prepare(
        "SELECT u.id, u.username, u.firstname, u.lastname, u.avatar, u.bio,

                (SELECT COUNT(*) FROM follows f
                 WHERE f.following_id = u.id) AS followers,

                (SELECT COUNT(*) FROM follows f
                 WHERE f.follower_id = ? AND f.following_id = u.id) AS followed_by_me

         FROM users u
         WHERE u.deleted_at IS NULL
           AND (u.username LIKE ?
                OR u.firstname LIKE ?
                OR u.lastname LIKE ?
                OR CONCAT(u.firstname, ' ', u.lastname) LIKE ?)
         ORDER BY followers DESC
         LIMIT 30"
    );

    $stmt->bind_param("issss", $userId, $like, $like, $like, $like);
    $stmt->execute();

    $results = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $stmt->close();

}


$pageTitle = "Search";

require_once "includes/header.php";

?>

<main class="feed">

    <div class="card">

        <h2 class="section-title">

            <?php if ($q === ""): ?>

                Search people

            <?php else: ?>

                Results for "<?= htmlspecialchars($q); ?>"

            <?php endif; ?>

        </h2>

        <?php if ($q === ""): ?>

            <p class="muted">Type a name or username in the search bar above.</p>

        <?php elseif (count($results) === 0): ?>

            <p class="muted">No people found. Try a different name.</p>

        <?php endif; ?>

        <div class="user-list">

            <?php foreach ($results as $u): ?>

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