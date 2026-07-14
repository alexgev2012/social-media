<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId = (int)$_SESSION["user_id"];


/*
 * All my conversations, newest activity first — now also with
 * the read-state of the last message (for the ✓✓ in the preview).
 */

$stmt = $conn->prepare(
    "SELECT c.id,

            IF(c.user1_id = ?, c.user2_id, c.user1_id) AS partner_id,

            u.username, u.firstname, u.lastname, u.avatar,

            (SELECT m.content FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.id DESC LIMIT 1) AS last_message,

            (SELECT m.created_at FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.id DESC LIMIT 1) AS last_time,

            (SELECT m.sender_id FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.id DESC LIMIT 1) AS last_sender,

            (SELECT m.is_read FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.id DESC LIMIT 1) AS last_read,

            (SELECT COUNT(*) FROM messages m
             WHERE m.conversation_id = c.id
               AND m.sender_id != ?
               AND m.is_read = 0) AS unread

     FROM conversations c

     JOIN users u ON u.id = IF(c.user1_id = ?, c.user2_id, c.user1_id)

     WHERE (c.user1_id = ? OR c.user2_id = ?)
       AND u.deleted_at IS NULL

     HAVING last_message IS NOT NULL

     ORDER BY last_time DESC"
);

$stmt->bind_param("iiiii", $userId, $userId, $userId, $userId, $userId);
$stmt->execute();

$conversations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


// How many chats have something unread (for the subtitle)

$unreadChats = 0;

foreach ($conversations as $c) {

    if ($c["unread"] > 0) $unreadChats++;

}


$pageTitle = "Messages";

require_once "includes/header.php";

?>

<main class="feed">

    <div class="card">

        <div class="inbox-head">

            <div>

                <h2 class="section-title">Messages</h2>

                <span class="inbox-sub">

                    <?php if ($unreadChats > 0): ?>

                        <?= $unreadChats; ?> unread <?= $unreadChats === 1 ? "chat" : "chats"; ?>

                    <?php elseif (count($conversations) > 0): ?>

                        All caught up ✓

                    <?php endif; ?>

                </span>

            </div>

        </div>

        <?php if (count($conversations) === 0): ?>

            <div class="inbox-empty">

                <span>💬</span>

                <p>No conversations yet.</p>

                <a href="search.php" class="submitBtn small">Find people to message</a>

            </div>

        <?php else: ?>

            <!-- Filter as you type -->

            <input type="text" id="convoSearch" class="inbox-search"
                   placeholder="Search conversations..." autocomplete="off">

            <p class="muted inbox-noresults" id="noResults" hidden>
                No conversations match that name.
            </p>

        <?php endif; ?>

        <div class="convo-list">

            <?php foreach ($conversations as $c): ?>

                <a href="chat.php?user=<?= $c["partner_id"]; ?>"
                   class="convo <?= $c["unread"] > 0 ? "unread" : ""; ?>"
                   data-name="<?= htmlspecialchars(mb_strtolower($c["firstname"] . " " . $c["lastname"] . " " . $c["username"])); ?>">

                    <?= avatarHtml($c["avatar"], $c["firstname"], $c["lastname"]); ?>

                    <div class="convo-info">

                        <strong><?= htmlspecialchars($c["firstname"] . " " . $c["lastname"]); ?></strong>

                        <span class="convo-preview">

                            <?php if ((int)$c["last_sender"] === $userId): ?>

                                <span class="preview-ticks <?= $c["last_read"] ? "read" : ""; ?>">✓✓</span>

                            <?php endif; ?>

                            <?php

                                $preview = $c["last_message"];

                                if (mb_strlen($preview) > 38) {
                                    $preview = mb_substr($preview, 0, 38) . "...";
                                }

                                echo htmlspecialchars($preview);

                            ?>

                        </span>

                    </div>

                    <div class="convo-meta">

                        <span class="convo-time <?= $c["unread"] > 0 ? "hot" : ""; ?>">
                            <?= chatTime($c["last_time"]); ?>
                        </span>

                        <?php if ($c["unread"] > 0): ?>

                            <span class="convo-badge">
                                <?= $c["unread"] > 9 ? "9+" : $c["unread"]; ?>
                            </span>

                        <?php endif; ?>

                    </div>

                </a>

            <?php endforeach; ?>

        </div>

    </div>

</main>

<script>

    // Filter conversations as you type

    const search = document.getElementById("convoSearch");


    if (search) {


        const rows = document.querySelectorAll(".convo");
        const noResults = document.getElementById("noResults");


        search.addEventListener("input", () => {


            const q = search.value.trim().toLowerCase();

            let visible = 0;


            rows.forEach((row) => {

                const match = row.dataset.name.includes(q);

                row.hidden = !match;

                if (match) visible++;

            });


            noResults.hidden = visible > 0;


        });


    }

</script>

<script src="assets/app.js"></script>

</body>
</html>