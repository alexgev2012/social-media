<?php
/*
 * Shared header + navbar.
 * Usage in a page:
 *   $pageTitle = "Home";
 *   require_once "includes/header.php";
 */

// Load current user's avatar for the navbar

$navStmt = $conn->prepare("SELECT avatar, firstname, lastname FROM users WHERE id = ?");
$navStmt->bind_param("i", $_SESSION["user_id"]);
$navStmt->execute();
$navUser = $navStmt->get_result()->fetch_assoc();
$navStmt->close();


// Unread counts for the navbar badges

$navUnread   = unreadNotifications($conn, $_SESSION["user_id"]);
$navMsgUnread = unreadMessages($conn, $_SESSION["user_id"]);

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title><?= htmlspecialchars($pageTitle ?? "Social"); ?></title>

    <link rel="stylesheet" href="assets/app.css">
</head>
<body>

<nav class="navbar">

    <div class="nav-inner">

        <a href="home.php" class="logo">Social</a>

        <!-- People search -->

        <form class="nav-search" action="search.php" method="GET">

            <input
                type="text"
                name="q"
                placeholder="Search people..."
                value="<?= htmlspecialchars($_GET["q"] ?? ""); ?>"
                autocomplete="off"
            >

        </form>

        <div class="nav-user">

            <a href="home.php" class="nav-link" title="Home">🏠</a>

            <!-- Messages -->

            <a href="messages.php" class="nav-link nav-bell" title="Messages">

                ✉️

                <span class="notifBadge" id="msgBadge" <?= $navMsgUnread > 0 ? "" : "hidden"; ?>>
                    <?= $navMsgUnread > 9 ? "9+" : $navMsgUnread; ?>
                </span>

            </a>

            <!-- Notifications bell -->

            <a href="notifications.php" class="nav-link nav-bell" title="Notifications">

                🔔

                <span class="notifBadge" id="notifBadge" <?= $navUnread > 0 ? "" : "hidden"; ?>>
                    <?= $navUnread > 9 ? "9+" : $navUnread; ?>
                </span>

            </a>

            <a href="profile.php" class="nav-avatar" title="My profile">
                <?= avatarHtml($navUser["avatar"], $navUser["firstname"], $navUser["lastname"], "nav"); ?>
            </a>

            <a href="logout.php" class="logoutBtn">Log out</a>

        </div>

    </div>

</nav>