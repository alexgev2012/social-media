<?php

session_start();

require_once "includes/database.php";

$error = "";
$success = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $username  = trim($_POST["username"]);
    $firstname = trim($_POST["firstname"]);
    $lastname  = trim($_POST["lastname"]);
    $email     = trim($_POST["email"]);
    $password  = $_POST["password"];
    $confirm   = $_POST["confirm_password"];


    // Validation

    if (empty($username) || empty($firstname) || empty($lastname) || empty($email) || empty($password)) {

        $error = "All fields are required.";

    }

    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {

        $error = "Invalid email address.";

    }

    elseif ($password !== $confirm) {

        $error = "Passwords do not match.";

    }

    elseif (strlen($password) < 8) {

        $error = "Password must contain at least 8 characters.";

    }

    else {


        // Check existing username/email

        $check = $conn->prepare(
            "SELECT id FROM users WHERE username = ? OR email = ?"
        );

        $check->bind_param(
            "ss",
            $username,
            $email
        );

        $check->execute();

        $result = $check->get_result();


        if ($result->num_rows > 0) {

            $error = "Username or email already exists.";

        }

        else {


            // Hash password

            $hashedPassword = password_hash(
                $password,
                PASSWORD_DEFAULT
            );


            // Insert user

            $status = 0;


            $stmt = $conn->prepare(
                "INSERT INTO users 
                (username, firstname, lastname, password, email, status)
                VALUES (?, ?, ?, ?, ?, ?)"
            );


            $stmt->bind_param(
                "sssssi",
                $username,
                $firstname,
                $lastname,
                $hashedPassword,
                $email,
                $status
            );


            if ($stmt->execute()) {


                $_SESSION["user_id"] = $stmt->insert_id;
                $_SESSION["username"] = $username;


                header("Location: home.php");
                exit;


            } else {

                $error = "Something went wrong. Please try again.";

            }


            $stmt->close();

        }


        $check->close();

    }

}

?>



<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Create Account</title>

    <link rel="stylesheet" href="assets/auth.css">
</head>
<body>

<div class="container">

    <div class="auth-header">
        <h1>Create Account</h1>
        <p>Join our community today.</p>
    </div>
<?php if($error): ?>

<div class="auth-alert error-alert">

    <div class="alert-icon">
        ⚠️
    </div>

    <div class="alert-content">

        <strong>Registration failed</strong>

        <span>
            <?= htmlspecialchars($error); ?>
        </span>

    </div>

</div>

<?php endif; ?>

<form id="registerForm" method="POST" autocomplete="off" novalidate>

    <!-- Username -->
    <div class="inputBox">

        <label for="username">Username</label>

        <input
            type="text"
            id="username"
            name="username"
            placeholder="Choose a username"
            maxlength="20"
            required
        >

        <small class="error"></small>

    </div>

    <!-- First Name -->
    <div class="inputBox">

        <label for="firstname">First Name</label>

        <input
            type="text"
            id="firstname"
            name="firstname"
            placeholder="Enter your first name"
            required
        >

        <small class="error"></small>

    </div>

    <!-- Last Name -->
    <div class="inputBox">

        <label for="lastname">Last Name</label>

        <input
            type="text"
            id="lastname"
            name="lastname"
            placeholder="Enter your last name"
            required
        >

        <small class="error"></small>

    </div>

    <!-- Email -->
    <div class="inputBox">

        <label for="email">Email</label>

        <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            required
        >

        <small class="error"></small>

    </div>

    <!-- Password -->
    <div class="inputBox">

        <label for="password">Password</label>

        <div class="passwordBox">

            <input
                type="password"
                id="password"
                name="password"
                placeholder="Create a password"
                required
            >

            <button
                type="button"
                class="togglePassword"
                data-target="password">
                👁
            </button>

        </div>

        <div class="strength">
            <div class="bar"></div>
        </div>

        <div class="strengthText"></div>

        <small class="error"></small>

    </div>

    <!-- Confirm Password -->
    <div class="inputBox">

        <label for="confirm">Confirm Password</label>

        <div class="passwordBox">

            <input
                type="password"
                id="confirm"
                name="confirm_password"
                placeholder="Repeat your password"
                required
            >

            <button
                type="button"
                class="togglePassword"
                data-target="confirm">
                👁
            </button>

        </div>

        <small class="error"></small>

    </div>

    <button
        type="submit"
        id="registerBtn"
        class="submitBtn">

        Create Account

    </button>

</form>


    <div class="login">

        Already have an account?

        <a href="login.php">Sign In</a>

    </div>

</div>

<script src="assets/register.js"></script>

</body>
</html>
