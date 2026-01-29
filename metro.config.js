const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Говорим сборщику: "db - это нормальный файл, бери его"
config.resolver.assetExts.push('db');

module.exports = config;