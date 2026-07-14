<?php

session_start();

require_once "includes/functions.php";

requireLogin();


$userId  = $_SESSION["user_id"];
$error   = "";
$success = "";


// Load current values

$stmt = $conn->prepare(
    "SELECT firstname, lastname, bio, avatar FROM users WHERE id = ?"
);

$stmt->bind_param("i", $userId);
$stmt->execute();

$me = $stmt->get_result()->fetch_assoc();

$stmt->close();


// Handle save

if ($_SERVER["REQUEST_METHOD"] === "POST") {


    $firstname = trim($_POST["firstname"] ?? "");
    $lastname  = trim($_POST["lastname"] ?? "");
    $bio       = trim($_POST["bio"] ?? "");


    if ($firstname === "" || $lastname === "") {

        $error = "First and last name are required.";

    }

    elseif (mb_strlen($bio) > 300) {

        $error = "Bio is too long (max 300 characters).";

    }

    else {


        // Optional new avatar (max 2 MB)

        $avatar = validateImage($_FILES["avatar"] ?? null, 2097152);


        if (is_array($avatar) && isset($avatar["error"])) {

            $error = $avatar["error"];

        }

        else {


            if ($avatar !== null) {


                // New avatar → the bytes go INSIDE this user's row.
                // Old file on disk (legacy) gets cleaned up.

                if (!empty($me["avatar"]) && file_exists($me["avatar"])) {
                    unlink($me["avatar"]);
                }


                // The &v=timestamp part changes on every new avatar, so the
                // browser doesn't keep showing a cached old picture.

                $avatarUrl  = "media.php?t=av&id=" . $userId . "&v=" . time();
                $avatarMime = $avatar["mime"];

                $null = null;


                $stmt = $conn->prepare(
                    "UPDATE users
                     SET firstname = ?, lastname = ?, bio = ?,
                         avatar = ?, avatar_mime = ?, avatar_data = ?,
                         updated_at = NOW()
                     WHERE id = ?"
                );

                $stmt->bind_param("sssssbi", $firstname, $lastname, $bio,
                                  $avatarUrl, $avatarMime, $null, $userId);

                sendBlob($stmt, 5, $avatar["tmp"]);   // 6th param (index 5)

                $stmt->execute();
                $stmt->close();


            } else {


                // No new avatar → update only the text fields

                $stmt = $conn->prepare(
                    "UPDATE users
                     SET firstname = ?, lastname = ?, bio = ?, updated_at = NOW()
                     WHERE id = ?"
                );

                $stmt->bind_param("sssi", $firstname, $lastname, $bio, $userId);
                $stmt->execute();
                $stmt->close();

            }


            // Keep the session in sync

            $_SESSION["firstname"] = $firstname;
            $_SESSION["lastname"]  = $lastname;


            header("Location: profile.php");
            exit;

        }

    }


    // Keep the typed values on error

    $me["firstname"] = $firstname;
    $me["lastname"]  = $lastname;
    $me["bio"]       = $bio;

}


$pageTitle = "Edit profile";

require_once "includes/header.php";

?>

<main class="feed">

    <div class="card">

        <h2 class="section-title">Edit profile</h2>

        <?php if ($error): ?>

            <div class="composer-error"><?= htmlspecialchars($error); ?></div>

        <?php endif; ?>

        <form method="POST" enctype="multipart/form-data" class="edit-form">

            <!-- Avatar -->

            <div class="edit-avatar">

                <?= avatarHtml($me["avatar"], $me["firstname"], $me["lastname"], "big"); ?>

                <label class="photoBtn">

                    📷 Change photo

                    <input type="file" name="avatar"
                           accept="image/jpeg,image/png,image/gif,image/webp" hidden>

                </label>

            </div>

            <!-- First name -->

            <div class="inputBox">

                <label for="firstname">First name</label>

                <input type="text" id="firstname" name="firstname"
                       value="<?= htmlspecialchars($me["firstname"]); ?>" required>

            </div>

            <!-- Last name -->

            <div class="inputBox">

                <label for="lastname">Last name</label>

                <input type="text" id="lastname" name="lastname"
                       value="<?= htmlspecialchars($me["lastname"]); ?>" required>

            </div>

            <!-- Bio -->

            <div class="inputBox">

                <label for="bio">Bio</label>

                <textarea id="bio" name="bio" rows="3" maxlength="300"
                          placeholder="Tell people a bit about yourself..."><?= htmlspecialchars($me["bio"] ?? ""); ?></textarea>

            </div>

            <div class="edit-actions">

                <a href="profile.php" class="outlineBtn">Cancel</a>

                <button type="submit" class="submitBtn">Save changes</button>

            </div>

        </form>

    </div>

</main>

</body>
</html>