<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId    = (int)$_SESSION["user_id"];
$partnerId = (int)($_GET["user"] ?? 0);


if ($partnerId === $userId || $partnerId <= 0) {

    header("Location: messages.php");
    exit;

}


// The partner must exist

$stmt = $conn->prepare(
    "SELECT id, username, firstname, lastname, avatar
     FROM users
     WHERE id = ? AND deleted_at IS NULL"
);

$stmt->bind_param("i", $partnerId);
$stmt->execute();

$partner = $stmt->get_result()->fetch_assoc();

$stmt->close();


if (!$partner) {

    header("Location: messages.php");
    exit;

}


// Find our conversation

$a = min($userId, $partnerId);
$b = max($userId, $partnerId);


$stmt = $conn->prepare(
    "SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?"
);

$stmt->bind_param("ii", $a, $b);
$stmt->execute();

$conversation = $stmt->get_result()->fetch_assoc();

$stmt->close();


$messages = [];
$lastId   = 0;


if ($conversation) {


    $stmt = $conn->prepare(
        "SELECT id, sender_id, content, is_read, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY id ASC
         LIMIT 200"
    );

    $stmt->bind_param("i", $conversation["id"]);
    $stmt->execute();

    $messages = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $stmt->close();


    if (count($messages) > 0) {
        $lastId = (int)end($messages)["id"];
    }


    // Opening the chat = reading their messages

    $stmt = $conn->prepare(
        "UPDATE messages SET is_read = 1
         WHERE conversation_id = ? AND sender_id = ? AND is_read = 0"
    );

    $stmt->bind_param("ii", $conversation["id"], $partnerId);
    $stmt->execute();
    $stmt->close();

}


// "Today" / "Yesterday" / date for the chips

function chipLabel($ymd) {

    if ($ymd === date("Y-m-d")) return "Today";

    if ($ymd === date("Y-m-d", strtotime("-1 day"))) return "Yesterday";

    return date("M j, Y", strtotime($ymd));

}


$pageTitle = $partner["firstname"] . " " . $partner["lastname"];

require_once "includes/header.php";

?>

<main class="feed chat-page">

    <div class="card chat-card">

        <!-- Chat header -->

        <div class="chat-header">

            <a href="messages.php" class="chat-back" title="Back to messages">←</a>

            <a href="profile.php?id=<?= $partner["id"]; ?>" class="chat-partner">

                <?= avatarHtml($partner["avatar"], $partner["firstname"], $partner["lastname"]); ?>

                <span class="chat-partner-name">

                    <strong><?= htmlspecialchars($partner["firstname"] . " " . $partner["lastname"]); ?></strong>

                    <span id="partnerStatus">@<?= htmlspecialchars($partner["username"]); ?></span>

                </span>

            </a>

        </div>

        <!-- Messages -->

        <div class="chat-messages" id="chatMessages">

            <?php if (count($messages) === 0): ?>

                <div class="chat-empty" id="chatEmpty">

                    <span class="chat-empty-wave">👋</span>

                    <p>Say hi to <?= htmlspecialchars($partner["firstname"]); ?></p>

                </div>

            <?php endif; ?>

            <?php $prevDate = ""; ?>

            <?php foreach ($messages as $m): ?>

                <?php

                    $day = date("Y-m-d", strtotime($m["created_at"]));

                    if ($day !== $prevDate) {

                        echo '<div class="date-chip"><span>' . chipLabel($day) . '</span></div>';

                        $prevDate = $day;

                    }

                    $mine  = (int)$m["sender_id"] === $userId;
                    $jumbo = isJumboEmoji($m["content"]);

                ?>

                <div class="bubble-row <?= $mine ? "mine" : "theirs"; ?>"
                     data-id="<?= $m["id"]; ?>">

                    <div class="bubble <?= $jumbo ? "jumbo" : ""; ?>">

                        <?= linkifyText($m["content"]); ?>

                        <span class="meta">

                            <?= date("H:i", strtotime($m["created_at"])); ?>

                            <?php if ($mine): ?>

                                <span class="ticks <?= $m["is_read"] ? "read" : ""; ?>">✓✓</span>

                            <?php endif; ?>

                        </span>

                    </div>

                </div>

            <?php endforeach; ?>

        </div>

        <!-- Jump back down when scrolled up -->

        <button type="button" class="scrollDownBtn" id="scrollDownBtn" hidden title="To the latest messages">↓</button>

        <!-- Emoji picker -->

        <div class="emoji-panel" id="emojiPanel" hidden></div>

        <!-- Input -->

        <form class="chat-form" id="chatForm">

            <button type="button" class="emojiToggle" id="emojiToggle" title="Emoji">😊</button>

            <textarea id="chatInput" placeholder="Message" rows="1"
                      maxlength="2000" autocomplete="off"></textarea>

            <button type="submit" class="sendBtn" title="Send">➤</button>

        </form>

    </div>

</main>

<script>

    const PARTNER_ID = <?= $partnerId; ?>;

    const PARTNER_USERNAME = <?= json_encode("@" . $partner["username"]); ?>;

    let lastId = <?= $lastId; ?>;

    let hasTodayChip = <?= json_encode($prevDate === date("Y-m-d")) ?>;


    const box = document.getElementById("chatMessages");
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");
    const statusEl = document.getElementById("partnerStatus");
    const scrollBtn = document.getElementById("scrollDownBtn");
    const emojiToggle = document.getElementById("emojiToggle");
    const emojiPanel = document.getElementById("emojiPanel");


    // ============ helpers ============

    function escapeHtml(text) {

        const div = document.createElement("div");
        div.textContent = text;

        return div.innerHTML;

    }


    // Escape first, THEN make the (safe) links clickable

    function linkify(text) {

        return escapeHtml(text)
            .replace(/\n/g, "<br>")
            .replace(/(https?:\/\/[^\s<]+)/gi,
                     '<a href="$1" target="_blank" rel="noopener">$1</a>');

    }


    // Emoji-only short messages render big

    function isJumbo(text) {

        const t = text.trim();

        return t.length > 0 && t.length <= 8 && !/[\p{L}\p{N}\p{P}]/u.test(t);

    }


    function nearBottom() {

        return box.scrollHeight - box.scrollTop - box.clientHeight < 120;

    }


    function scrollDown(smooth = false) {

        box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" });

    }


    // ============ rendering ============

    function appendMessage(m) {


        const empty = document.getElementById("chatEmpty");

        if (empty) empty.remove();


        if (!hasTodayChip) {

            const chip = document.createElement("div");

            chip.className = "date-chip";
            chip.innerHTML = "<span>Today</span>";

            box.appendChild(chip);

            hasTodayChip = true;

        }


        const stick = nearBottom();


        const row = document.createElement("div");

        row.className = "bubble-row new " + (m.mine ? "mine" : "theirs");

        row.dataset.id = m.id;

        row.innerHTML = `
            <div class="bubble ${isJumbo(m.content) ? "jumbo" : ""}">
                ${linkify(m.content)}
                <span class="meta">
                    ${escapeHtml(m.time)}
                    ${m.mine ? '<span class="ticks">✓✓</span>' : ''}
                </span>
            </div>
        `;

        box.appendChild(row);


        if (m.id > lastId) {
            lastId = m.id;
        }


        if (stick || m.mine) {
            scrollDown();
        }

    }


    // Their read position moved → my ✓✓ up to that message turn blue

    function updateTicks(readUpTo) {

        document.querySelectorAll(".bubble-row.mine").forEach((row) => {

            if (parseInt(row.dataset.id) <= readUpTo) {

                const ticks = row.querySelector(".ticks");

                if (ticks) ticks.classList.add("read");

            }

        });

    }


    // ============ sending ============

    async function send() {


        const content = input.value.trim();

        if (content === "") return;


        input.value = "";
        input.style.height = "auto";
        input.focus();


        try {

            const body = new FormData();
            body.append("user_id", PARTNER_ID);
            body.append("content", content);


            const res = await fetch("chat_send.php", { method: "POST", body });

            const data = await res.json();


            if (data.error) {
                alert(data.error);
                input.value = content;
                return;
            }


            appendMessage(data.message);


        } catch (err) {

            alert("Message not sent. Please try again.");

            input.value = content;

        }

    }


    form.addEventListener("submit", (e) => {

        e.preventDefault();

        send();

    });


    // Enter sends, Shift+Enter makes a new line

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            send();

        }

    });


    // The input grows with the text (up to 5 lines)

    input.addEventListener("input", () => {

        input.style.height = "auto";

        input.style.height = Math.min(input.scrollHeight, 120) + "px";

    });


    // ============ typing indicator ============

    // While I type: ping the server every 2s ("I'm typing").
    // The partner's poll sees the fresh timestamp and shows "typing...".

    let lastTypingPing = 0;


    input.addEventListener("input", () => {


        const now = Date.now();

        if (now - lastTypingPing < 2000) return;

        lastTypingPing = now;


        const body = new FormData();
        body.append("user_id", PARTNER_ID);

        fetch("chat_typing.php", { method: "POST", body }).catch(() => {});


    });


    // ============ polling ============

    async function poll() {

        try {

            const res = await fetch("chat_fetch.php?user=" + PARTNER_ID + "&after=" + lastId);

            const data = await res.json();


            if (Array.isArray(data.messages)) {
                data.messages.forEach(appendMessage);
            }


            // "typing..." replaces the @username while they type

            if (data.typing) {

                statusEl.textContent = "typing...";
                statusEl.classList.add("is-typing");

            } else {

                statusEl.textContent = PARTNER_USERNAME;
                statusEl.classList.remove("is-typing");

            }


            if (typeof data.read_up_to === "number" && data.read_up_to > 0) {
                updateTicks(data.read_up_to);
            }


        } catch (err) {
            // Next poll catches up
        }

    }

    setInterval(poll, 2000);


    // ============ scroll-to-bottom button ============

    box.addEventListener("scroll", () => {

        scrollBtn.hidden = nearBottom();

    });

    scrollBtn.addEventListener("click", () => scrollDown(true));


    // ============ emoji picker ============

    const EMOJI = ["😀","😂","🥰","😍","😎","🤔","👍","👏","🙏","💪",
                   "❤️","🔥","🎉","😢","😮","😅","🤣","💯","✨","🌹",
                   "☕","🍕","⚽","🎵"];


    EMOJI.forEach((e) => {

        const b = document.createElement("button");

        b.type = "button";
        b.textContent = e;

        b.addEventListener("click", () => {


            // Insert at the cursor position

            const start = input.selectionStart;

            input.value = input.value.slice(0, start) + e + input.value.slice(input.selectionEnd);

            input.selectionStart = input.selectionEnd = start + e.length;

            input.focus();

            input.dispatchEvent(new Event("input"));


        });

        emojiPanel.appendChild(b);

    });


    emojiToggle.addEventListener("click", () => {

        emojiPanel.hidden = !emojiPanel.hidden;

    });


    // Clicking anywhere else closes the picker

    document.addEventListener("click", (e) => {

        if (!emojiPanel.hidden &&
            !emojiPanel.contains(e.target) &&
            e.target !== emojiToggle) {

            emojiPanel.hidden = true;

        }

    });


    scrollDown();

    input.focus();

</script>

</body>
</html>