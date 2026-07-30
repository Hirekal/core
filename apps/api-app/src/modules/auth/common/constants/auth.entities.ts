import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { UserRole } from '../../users/user-roles/entities/user-role.entity';
import { UserSession } from '../../users/user-sessions/entities/user-session.entity';
import { UserCode } from '../../users/user-codes/entities/user-code.entity';
import { EmailLog } from '../../emails/entities/email-log.entity';

export const AUTH_ENTITIES = [
  Organization,
  User,
  Role,
  UserRole,
  UserSession,
  UserCode,
  EmailLog,
];
