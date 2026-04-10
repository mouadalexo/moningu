const { PermissionFlagsBits } = require('discord.js');

function hasManagerAccess(member, dynamicRoles) {
  if (!member) return false;
  if (member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions && member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (dynamicRoles && dynamicRoles.managerRoleId) {
    return member.roles && member.roles.cache.has(dynamicRoles.managerRoleId);
  }
  if (dynamicRoles && dynamicRoles.requiredRoleId) {
    return member.roles && member.roles.cache.has(dynamicRoles.requiredRoleId);
  }
  return false;
}

module.exports = { hasManagerAccess };
