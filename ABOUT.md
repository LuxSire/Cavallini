# Cavallini Application Overview

## What This Application Does

This is a React-based web application for Cavallini Capital. It provides:
- A secure email access form for users to request or gain access to the website.
- Email validation against an allowlist (emails.csv) to restrict access to authorized users.
- A request approval workflow: users not on the allowlist can send a pre-filled email to the administrator to request access.
- A protected area (Cavallini page) only accessible to approved users.
- Backend API (Node.js/Express) to append new emails to the allowlist (emails.csv) when users are approved.

## What the Application Can Do If GoDaddy Supports Node.js

If your GoDaddy hosting plan supports Node.js, the application can:
- Run the backend API (Express server) to allow dynamic updates to the emails.csv file.
- Enable real-time approval: when a user requests access, their email can be programmatically added to the allowlist by the backend.
- Provide a seamless user experience with both frontend and backend hosted on the same domain.
- Support future enhancements such as logging, admin dashboards, or more advanced access control.

If GoDaddy does NOT support Node.js, the backend features (dynamic email approval) will not be available, and the allowlist must be managed manually.

## Development Cost

The development of this website is priced at **$2,400**.

---
For questions or further customization, please contact the developer.
