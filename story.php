<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId   = (int)$_SESSION["user_id"];
$targetId = (int)($_GET["user"] ?? 0);


// Whose stories are we watching?

$stmt = $conn->prepare(
    "SELECT id, username, firstname, lastname, avatar
     FROM users
     WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $targetId);
$stmt->execute();

$owner = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$owner) {

    header("Location: home.php");
    exit;

}


// Their active stories (last 24 hours), oldest first,
// plus whether I already liked each one

$stmt = $conn->prepare(
    "SELECT s.id, s.image, s.video, s.created_at,

            (SELECT COUNT(*) FROM likes l
             WHERE l.content_type = 'story' AND l.content_id = s.id
               AND l.user_id = ? AND l.deleted_at IS NULL) AS liked_by_me

     FROM stories s
     WHERE s.user_id = ?
       AND s.created_at > NOW() - INTERVAL 24 HOUR
     ORDER BY s.created_at ASC"
);

$stmt->bind_param("ii", $userId, $targetId);
$stmt->execute();

$stories = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$stmt->close();


if (count($stories) === 0) {

    header("Location: home.php");
    exit;

}


$isOwner = $targetId === $userId;


// Mark them all as seen by me

if (!$isOwner) {

    $stmt = $conn->prepare(
        "INSERT IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)"
    );

    foreach ($stories as $s) {

        $sid = (int)$s["id"];

        $stmt->bind_param("ii", $sid, $userId);
        $stmt->execute();

    }

    $stmt->close();

}


/*
 * If they're MY stories: the full viewer list per story —
 * who watched, when, and whether they LIKED it (the little ❤️
 * next to a viewer, like Instagram).
 */

$viewersByStory = [];

if ($isOwner) {

    $stmt = $conn->prepare(
        "SELECT v.story_id, v.created_at AS viewed_at,
                u.username, u.firstname, u.lastname, u.avatar,

                (SELECT COUNT(*) FROM likes l
                 WHERE l.content_type = 'story'
                   AND l.content_id = v.story_id
                   AND l.user_id = v.user_id
                   AND l.deleted_at IS NULL) AS liked

         FROM story_views v
         JOIN users u ON u.id = v.user_id
         WHERE v.story_id IN (SELECT id FROM stories WHERE user_id = ?)
           AND u.deleted_at IS NULL
         ORDER BY liked DESC, v.created_at DESC"
    );

    $stmt->bind_param("i", $targetId);
    $stmt->execute();

    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {

        $viewersByStory[$row["story_id"]][] = [
            "name"     => $row["firstname"] . " " . $row["lastname"],
            "username" => $row["username"],
            "avatar"   => $row["avatar"] ?: null,
            "initials" => initials($row["firstname"], $row["lastname"]),
            "time"     => timeAgo($row["viewed_at"]),
            "liked"    => (bool)$row["liked"]
        ];

    }

    $stmt->close();

}


// Prepare the data for JavaScript

$storyData = [];

foreach ($stories as $s) {

    $storyData[] = [
        "id"      => (int)$s["id"],
        "type"    => $s["video"] ? "video" : "image",
        "src"     => $s["video"] ?: $s["image"],
        "time"    => timeAgo($s["created_at"]),
        "liked"   => (bool)$s["liked_by_me"],
        "viewers" => $isOwner ? ($viewersByStory[$s["id"]] ?? []) : null
    ];

}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Story · <?= htmlspecialchars($owner["firstname"]); ?></title>

    <style>

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, sans-serif;
        }

        /* CRITICAL: the hidden attribute must always win over any
           display: flex/block in this stylesheet. Without this rule,
           the viewers panel stays permanently open and blocks all
           the buttons underneath it. */

        [hidden] {
            display: none !important;
        }

        body {
            min-height: 100vh;
            background: #111827;

            display: flex;
            justify-content: center;
            align-items: center;
        }

        .viewer {
            position: relative;

            width: 100%;
            max-width: 440px;
            height: 100vh;
            max-height: 800px;

            background: #000;
            border-radius: 14px;
            overflow: hidden;
        }

        /* Progress bars */

        .bars {
            position: absolute;
            top: 12px;
            left: 12px;
            right: 12px;
            z-index: 3;

            display: flex;
            gap: 5px;
        }

        .bar {
            flex: 1;
            height: 3px;

            background: rgba(255, 255, 255, .3);
            border-radius: 100px;

            overflow: hidden;
        }

        .bar .fill {
            display: block;
            width: 0;
            height: 100%;

            background: #fff;
            border-radius: 100px;
        }

        /* Header */

        .story-header {
            position: absolute;
            top: 26px;
            left: 12px;
            right: 12px;
            z-index: 3;

            display: flex;
            align-items: center;
            gap: 10px;

            color: #fff;
        }

        .story-header img,
        .story-header .avatar {
            width: 36px;
            height: 36px;

            border-radius: 50%;
            object-fit: cover;

            display: flex;
            align-items: center;
            justify-content: center;

            background: linear-gradient(135deg, #4f46e5, #7c3aed);

            font-size: 12px;
            font-weight: 700;
        }

        .story-header strong {
            font-size: 14px;
        }

        .story-header .time {
            font-size: 13px;
            color: rgba(255, 255, 255, .7);
        }

        .headBtn {
            border: none;
            background: none;

            color: #fff;
            font-size: 20px;

            cursor: pointer;
        }

        .headBtn.close {
            font-size: 22px;
        }

        .head-spacer {
            margin-left: auto;
        }

        /* The media */

        .story-image,
        .story-video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        /* Unmute button */

        .unmuteBtn {
            position: absolute;
            bottom: 110px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 4;

            border: none;
            border-radius: 100px;

            padding: 10px 20px;

            background: rgba(255, 255, 255, .9);
            color: #111827;

            font-size: 14px;
            font-weight: 700;

            cursor: pointer;
        }

        /* Tap zones */

        .tap {
            position: absolute;
            top: 0;
            bottom: 90px;
            z-index: 2;

            width: 35%;

            border: none;
            background: none;
            cursor: pointer;
        }

        .tap.prev { left: 0; }
        .tap.next { right: 0; width: 65%; }

        /* Bottom action area */

        .story-footer {
            position: absolute;
            bottom: 18px;
            left: 0;
            right: 0;
            z-index: 3;

            display: flex;
            justify-content: center;
        }

        /* Views button (own stories) */

        .viewsBtn {
            border: none;
            border-radius: 100px;

            padding: 9px 18px;

            background: rgba(17, 24, 39, .55);
            color: #fff;

            font-size: 14px;
            font-weight: 600;

            cursor: pointer;
        }

        .viewsBtn:hover {
            background: rgba(17, 24, 39, .8);
        }

        /* Like button (other people's stories) */

        .storyLikeBtn {
            border: none;
            border-radius: 100px;

            padding: 9px 22px;

            background: rgba(17, 24, 39, .55);
            color: #fff;

            font-size: 20px;
            line-height: 1;

            cursor: pointer;

            transition: transform .15s;
        }

        .storyLikeBtn:active {
            transform: scale(1.25);
        }

        /* Viewers panel */

        .viewersPanel {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 5;

            max-height: 60%;

            display: flex;
            flex-direction: column;

            background: #fff;

            border-radius: 20px 20px 0 0;

            animation: slideUp .25s ease;
        }

        @keyframes slideUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
        }

        .viewersHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;

            padding: 16px 20px 12px;

            border-bottom: 1px solid #f3f4f6;
        }

        .viewersHeader strong {
            color: #111827;
            font-size: 16px;
        }

        .viewersHeader button {
            border: none;
            background: none;

            color: #6b7280;
            font-size: 18px;

            cursor: pointer;
        }

        .viewersList {
            overflow-y: auto;
            padding: 8px 20px 20px;
        }

        .viewerRow {
            display: flex;
            align-items: center;
            gap: 12px;

            padding: 10px 0;
        }

        .viewerRow img,
        .viewerRow .mini-avatar {
            width: 40px;
            height: 40px;

            flex-shrink: 0;

            border-radius: 50%;
            object-fit: cover;

            display: flex;
            align-items: center;
            justify-content: center;

            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: #fff;

            font-size: 13px;
            font-weight: 700;
        }

        .viewerInfo {
            flex: 1;
            min-width: 0;
        }

        .viewerInfo strong {
            display: block;

            color: #111827;
            font-size: 14px;
        }

        .viewerInfo span {
            color: #6b7280;
            font-size: 12px;
        }

        .viewerLiked {
            font-size: 16px;
        }

        .viewerTime {
            color: #9ca3af;
            font-size: 12px;
        }

        .noViewers {
            padding: 25px 0;

            text-align: center;

            color: #6b7280;
            font-size: 14px;
        }

    </style>
</head>
<body>

<div class="viewer">

    <!-- Progress bars -->

    <div class="bars">

        <?php foreach ($stories as $s): ?>

            <div class="bar"><span class="fill"></span></div>

        <?php endforeach; ?>

    </div>

    <!-- Header -->

    <div class="story-header">

        <?php if ($owner["avatar"]): ?>

            <img src="<?= htmlspecialchars($owner["avatar"]); ?>" alt="">

        <?php else: ?>

            <div class="avatar"><?= htmlspecialchars(initials($owner["firstname"], $owner["lastname"])); ?></div>

        <?php endif; ?>

        <strong><?= htmlspecialchars($owner["firstname"] . " " . $owner["lastname"]); ?></strong>

        <span class="time" id="storyTime"></span>

        <span class="head-spacer"></span>

        <?php if ($isOwner): ?>

            <button class="headBtn" id="deleteStoryBtn" title="Delete story">🗑</button>

        <?php endif; ?>

        <button class="headBtn close" onclick="location.href='home.php'" title="Close">✕</button>

    </div>

    <!-- The media -->

    <img class="story-image" id="storyImage" src="" alt="Story" hidden>

    <video class="story-video" id="storyVideo" playsinline hidden></video>

    <button class="unmuteBtn" id="unmuteBtn" hidden>🔊 Tap for sound</button>

    <!-- Bottom: views button (mine) OR like button (theirs) -->

    <div class="story-footer">

        <?php if ($isOwner): ?>

            <button class="viewsBtn" id="viewsBtn"></button>

        <?php else: ?>

            <button class="storyLikeBtn" id="storyLikeBtn" title="Like"></button>

        <?php endif; ?>

    </div>

    <!-- Viewers panel -->

    <div class="viewersPanel" id="viewersPanel" hidden>

        <div class="viewersHeader">

            <strong id="viewersTitle">Viewers</strong>

            <button id="closeViewers" title="Close">✕</button>

        </div>

        <div class="viewersList" id="viewersList"></div>

    </div>

    <!-- Tap zones -->

    <button class="tap prev" title="Previous"></button>
    <button class="tap next" title="Next"></button>

</div>

<script>

    const STORIES = <?= json_encode($storyData); ?>;

    const IS_OWNER = <?= json_encode($isOwner); ?>;

    const IMAGE_DURATION = 5000;


    const image = document.getElementById("storyImage");
    const video = document.getElementById("storyVideo");
    const timeEl = document.getElementById("storyTime");
    const unmuteBtn = document.getElementById("unmuteBtn");
    const fills = document.querySelectorAll(".bar .fill");

    const viewsBtn = document.getElementById("viewsBtn");
    const likeBtn = document.getElementById("storyLikeBtn");
    const deleteBtn = document.getElementById("deleteStoryBtn");

    const panel = document.getElementById("viewersPanel");
    const panelTitle = document.getElementById("viewersTitle");
    const panelList = document.getElementById("viewersList");
    const closeViewers = document.getElementById("closeViewers");


    let current = 0;
    let timer = null;
    let startedAt = 0;
    let isPaused = false;


    function escapeHtml(text) {

        const div = document.createElement("div");
        div.textContent = text;

        return div.innerHTML;

    }


    function stopEverything() {

        clearInterval(timer);

        video.pause();
        video.removeAttribute("src");
        video.load();

        unmuteBtn.hidden = true;

    }


    function showStory(index) {


        if (index >= STORIES.length) {
            location.href = "home.php";
            return;
        }

        if (index < 0) index = 0;


        stopEverything();

        closePanel();

        current = index;

        const story = STORIES[current];


        timeEl.textContent = story.time;


        // Bottom button: views count (mine) or the heart (theirs)

        if (IS_OWNER) {

            const n = story.viewers.length;

            viewsBtn.textContent = "👁 " + n + " " + (n === 1 ? "view" : "views");

        } else {

            likeBtn.textContent = story.liked ? "❤️" : "🤍";

        }


        fills.forEach((fill, i) => {

            fill.style.width = i < current ? "100%" : "0";

        });


        if (story.type === "video") {

            showVideo(story);

        } else {

            showImage(story);

        }

    }


    // ---------- Photos: 5 second timer (freezes while paused) ----------

    function showImage(story) {

        video.hidden = true;
        image.hidden = false;

        image.src = story.src;


        startedAt = Date.now();


        timer = setInterval(() => {


            if (isPaused) {

                startedAt += 50;

                return;

            }


            const progress = (Date.now() - startedAt) / IMAGE_DURATION;

            if (progress >= 1) {

                showStory(current + 1);

            } else {

                fills[current].style.width = (progress * 100) + "%";

            }

        }, 50);

    }


    // ---------- Videos: real duration, advance when ended ----------

    function showVideo(story) {

        image.hidden = true;
        video.hidden = false;

        video.src = story.src;
        video.muted = false;


        video.play().catch(() => {

            video.muted = true;

            video.play();

            unmuteBtn.hidden = false;

        });


        timer = setInterval(() => {

            if (video.duration > 0) {

                fills[current].style.width = ((video.currentTime / video.duration) * 100) + "%";

            }

        }, 50);

    }


    video.addEventListener("ended", () => showStory(current + 1));


    unmuteBtn.addEventListener("click", () => {

        video.muted = false;

        unmuteBtn.hidden = true;

    });


    // ---------- Like (other people's stories) ----------

    if (likeBtn) {


        likeBtn.addEventListener("click", async () => {


            const story = STORIES[current];

            likeBtn.disabled = true;


            try {

                const body = new FormData();
                body.append("story_id", story.id);


                const res = await fetch("story_like.php", { method: "POST", body });

                const data = await res.json();


                if (data.error) {
                    alert(data.error);
                    return;
                }


                story.liked = data.liked;

                likeBtn.textContent = data.liked ? "❤️" : "🤍";


            } catch (err) {

                alert("Something went wrong. Please try again.");

            } finally {

                likeBtn.disabled = false;

            }


        });


    }


    // ---------- Delete (my own stories) ----------

    if (deleteBtn) {


        deleteBtn.addEventListener("click", async () => {


            if (!confirm("Delete this story?")) return;


            const story = STORIES[current];


            try {

                const body = new FormData();
                body.append("story_id", story.id);


                const res = await fetch("story_delete.php", { method: "POST", body });

                const data = await res.json();


                if (data.error) {
                    alert(data.error);
                    return;
                }


                // Last story deleted → home. Otherwise reload the viewer
                // (PHP rebuilds the list without the deleted one).

                if (STORIES.length <= 1) {

                    location.href = "home.php";

                } else {

                    location.reload();

                }


            } catch (err) {

                alert("Something went wrong. Please try again.");

            }


        });


    }


    // ---------- Viewers panel ----------

    function openPanel() {


        const story = STORIES[current];

        if (story.viewers === null) return;


        if (story.viewers.length === 0) {

            panelList.innerHTML = '<div class="noViewers">No views yet.</div>';

        } else {

            panelList.innerHTML = story.viewers.map((v) => `

                <div class="viewerRow">

                    ${v.avatar
                        ? '<img src="' + escapeHtml(v.avatar) + '" alt="">'
                        : '<div class="mini-avatar">' + escapeHtml(v.initials) + '</div>'}

                    <div class="viewerInfo">

                        <strong>${escapeHtml(v.name)}</strong>

                        <span>@${escapeHtml(v.username)}</span>

                    </div>

                    ${v.liked ? '<span class="viewerLiked">❤️</span>' : ''}

                    <span class="viewerTime">${escapeHtml(v.time)}</span>

                </div>

            `).join("");

        }


        panelTitle.textContent = "Viewers (" + story.viewers.length + ")";

        panel.hidden = false;


        isPaused = true;

        if (STORIES[current].type === "video") {
            video.pause();
        }

    }


    function closePanel() {

        if (panel.hidden) return;

        panel.hidden = true;

        isPaused = false;

        if (STORIES[current] && STORIES[current].type === "video" && video.src) {
            video.play();
        }

    }


    if (viewsBtn) {
        viewsBtn.addEventListener("click", openPanel);
    }

    closeViewers.addEventListener("click", closePanel);


    // Tap zones

    document.querySelector(".tap.next").addEventListener("click", () => showStory(current + 1));
    document.querySelector(".tap.prev").addEventListener("click", () => showStory(current - 1));


    // Keyboard

    document.addEventListener("keydown", (e) => {

        if (e.key === "Escape") {

            if (!panel.hidden) {
                closePanel();
            } else {
                location.href = "home.php";
            }

            return;

        }

        if (e.key === "ArrowRight") showStory(current + 1);
        if (e.key === "ArrowLeft")  showStory(current - 1);

    });


    showStory(0);

</script>

</body>
</html>