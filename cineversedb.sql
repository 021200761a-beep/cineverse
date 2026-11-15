-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 10-11-2026 a las 06:42:34
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `cineversedb`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `admin_activity`
--

CREATE TABLE `admin_activity` (
  `activity_id` bigint(20) UNSIGNED NOT NULL,
  `admin_id` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `detail` varchar(1000) DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `admin_activity`
--

INSERT INTO `admin_activity` (`activity_id`, `admin_id`, `action`, `detail`, `ip_address`, `created_at`) VALUES
(1, 1, 'LOGIN', 'Inicio de sesión', '::1', '2026-11-09 04:44:24'),
(2, 1, 'LOGOUT', '', '::1', '2026-11-09 07:08:10'),
(3, 1, 'LOGIN', 'Inicio de sesión', '::1', '2026-11-09 07:08:59'),
(4, 1, 'CONTENT_OVERRIDE', 'tv: Phineas y Ferb', '::1', '2026-11-09 07:11:21'),
(5, 1, 'CONTENT_OVERRIDE', 'tv: Phineas y Ferb', '::1', '2026-11-09 07:11:41'),
(6, 1, 'LOGIN', 'Inicio de sesión', '::1', '2026-11-09 07:41:21'),
(7, 1, 'LOGOUT', '', '::1', '2026-11-09 07:41:28'),
(8, 1, 'LOGIN', 'Inicio de sesión', '::1', '2026-11-10 05:40:44'),
(9, 1, 'LOGOUT', '', '::1', '2026-11-10 05:40:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `admin_users`
--

CREATE TABLE `admin_users` (
  `admin_id` int(10) UNSIGNED NOT NULL,
  `username` varchar(80) NOT NULL,
  `full_name` varchar(160) NOT NULL,
  `email` varchar(254) DEFAULT NULL,
  `password_salt` varchar(128) NOT NULL,
  `password_hash` varchar(256) NOT NULL,
  `role` enum('SuperAdmin','Administrator','Editor','Analyst') NOT NULL DEFAULT 'Administrator',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `admin_users`
--

INSERT INTO `admin_users` (`admin_id`, `username`, `full_name`, `email`, `password_salt`, `password_hash`, `role`, `is_active`, `last_login_at`, `created_at`) VALUES
(1, 'admin', 'Administrador CineVerse', 'admin@cineverse.local', 'b2fbac405a1090dfef8bc2adcadbe011cbfef963989afc6d781ad5caea3852c7', '5c2cc0e720ec1065ca2c8095fae616a97d5951011561dd2f97d80c5eacba998ab2e7f02dab32d3be8517082ab008d2a25ab206548cd96f20241a1315a3e366fb', 'SuperAdmin', 1, '2026-11-10 00:40:44', '2026-11-07 17:47:47');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `content_overrides`
--

CREATE TABLE `content_overrides` (
  `content_override_id` int(10) UNSIGNED NOT NULL,
  `source` varchar(20) NOT NULL,
  `external_id` varchar(80) NOT NULL,
  `media_type` varchar(20) NOT NULL,
  `title` varchar(300) NOT NULL,
  `poster_url` varchar(1000) DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `is_hidden` tinyint(1) NOT NULL DEFAULT 0,
  `notes` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `content_overrides`
--

INSERT INTO `content_overrides` (`content_override_id`, `source`, `external_id`, `media_type`, `title`, `poster_url`, `is_featured`, `is_hidden`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'tmdb', '1877', 'tv', 'Phineas y Ferb', 'https://image.tmdb.org/t/p/w500/vO5SGen5sf8ooqXG99f1MohvcfV.jpg', 0, 0, NULL, '2026-11-09 07:11:21', '2026-11-09 07:11:21');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `search_metrics`
--

CREATE TABLE `search_metrics` (
  `search_metric_id` bigint(20) UNSIGNED NOT NULL,
  `search_term` varchar(300) NOT NULL,
  `media_type` varchar(20) DEFAULT NULL,
  `result_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `site_settings`
--

CREATE TABLE `site_settings` (
  `setting_id` int(10) UNSIGNED NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `site_settings`
--

INSERT INTO `site_settings` (`setting_id`, `setting_key`, `setting_value`, `description`, `updated_at`) VALUES
(1, 'site_name', 'CineVerse', 'Nombre público de la plataforma', '2026-11-07 17:32:21'),
(2, 'hero_title', 'Historias que te hacen sentir.', 'Título principal de inicio', '2026-11-07 17:32:21'),
(3, 'maintenance_mode', 'false', 'Activa o desactiva mantenimiento', '2026-11-07 17:32:21'),
(4, 'default_country', 'PE', 'País predeterminado', '2026-11-07 17:32:21'),
(5, 'featured_section', 'true', 'Mostrar sección de destacados', '2026-11-07 17:32:21');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_accounts`
--

CREATE TABLE `user_accounts` (
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `external_auth_id` varchar(150) DEFAULT NULL,
  `display_name` varchar(160) NOT NULL,
  `email` varchar(254) DEFAULT NULL,
  `password_salt` varchar(64) DEFAULT NULL,
  `password_hash` char(128) DEFAULT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `user_accounts`
--

INSERT INTO `user_accounts` (`user_id`, `external_auth_id`, `display_name`, `email`, `password_salt`, `password_hash`, `is_blocked`, `created_at`) VALUES
(1, NULL, 'ANTHONY GARCIA DAVALOS', '017100288i@uandina.edu.pe', 'f11cf34321fd551ee3519a0aa3a9c60f867e55b4e4b34993f0955ecf59bd9bef', 'ec94b3ef358f9d9054ce638553a229885f5b12f81b8d36d84a7a22c191b061ed65c2536a9710de0974e0c5b8f286671344df6abb8ed32d234a3634263fb1ac14', 0, '2026-11-10 05:39:10');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_favorites`
--

CREATE TABLE `user_favorites` (
  `favorite_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `source` varchar(20) NOT NULL,
  `external_id` varchar(80) NOT NULL,
  `media_type` varchar(20) NOT NULL,
  `title` varchar(300) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `user_favorites`
--

INSERT INTO `user_favorites` (`favorite_id`, `user_id`, `source`, `external_id`, `media_type`, `title`, `created_at`) VALUES
(1, 1, 'tmdb', '1368337', 'movie', 'La Odisea', '2026-11-10 05:39:31'),
(2, 1, 'tmdb', '1423191', 'movie', 'Resident Evil', '2026-11-10 05:39:32'),
(3, 1, 'tmdb', '1792170', 'movie', 'Model Citizen', '2026-11-10 05:39:33');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `admin_activity`
--
ALTER TABLE `admin_activity`
  ADD PRIMARY KEY (`activity_id`),
  ADD KEY `idx_activity_admin` (`admin_id`),
  ADD KEY `idx_activity_created` (`created_at`);

--
-- Indices de la tabla `admin_users`
--
ALTER TABLE `admin_users`
  ADD PRIMARY KEY (`admin_id`),
  ADD UNIQUE KEY `uq_admin_username` (`username`),
  ADD UNIQUE KEY `uq_admin_email` (`email`);

--
-- Indices de la tabla `content_overrides`
--
ALTER TABLE `content_overrides`
  ADD PRIMARY KEY (`content_override_id`),
  ADD UNIQUE KEY `uq_content_source_external_media` (`source`,`external_id`,`media_type`),
  ADD KEY `idx_content_media_type` (`media_type`),
  ADD KEY `idx_content_featured` (`is_featured`),
  ADD KEY `idx_content_hidden` (`is_hidden`);

--
-- Indices de la tabla `search_metrics`
--
ALTER TABLE `search_metrics`
  ADD PRIMARY KEY (`search_metric_id`),
  ADD KEY `idx_search_created` (`created_at`),
  ADD KEY `idx_search_type` (`media_type`);

--
-- Indices de la tabla `site_settings`
--
ALTER TABLE `site_settings`
  ADD PRIMARY KEY (`setting_id`),
  ADD UNIQUE KEY `uq_site_setting_key` (`setting_key`);

--
-- Indices de la tabla `user_accounts`
--
ALTER TABLE `user_accounts`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `uq_user_external_auth` (`external_auth_id`),
  ADD UNIQUE KEY `uq_user_accounts_email` (`email`),
  ADD KEY `idx_user_email` (`email`);

--
-- Indices de la tabla `user_favorites`
--
ALTER TABLE `user_favorites`
  ADD PRIMARY KEY (`favorite_id`),
  ADD UNIQUE KEY `uq_user_favorite` (`user_id`,`source`,`external_id`,`media_type`),
  ADD KEY `idx_favorites_user` (`user_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `admin_activity`
--
ALTER TABLE `admin_activity`
  MODIFY `activity_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `admin_users`
--
ALTER TABLE `admin_users`
  MODIFY `admin_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `content_overrides`
--
ALTER TABLE `content_overrides`
  MODIFY `content_override_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `search_metrics`
--
ALTER TABLE `search_metrics`
  MODIFY `search_metric_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `site_settings`
--
ALTER TABLE `site_settings`
  MODIFY `setting_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `user_accounts`
--
ALTER TABLE `user_accounts`
  MODIFY `user_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `user_favorites`
--
ALTER TABLE `user_favorites`
  MODIFY `favorite_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `admin_activity`
--
ALTER TABLE `admin_activity`
  ADD CONSTRAINT `fk_activity_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `user_favorites`
--
ALTER TABLE `user_favorites`
  ADD CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
