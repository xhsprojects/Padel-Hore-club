'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { MoreHorizontal, Edit, Trash2, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { format } from 'date-fns';
import type { UserProfile, WithId } from '@/lib/types';

interface UserManagementTableProps {
  users: WithId<UserProfile>[];
  isLoading: boolean;
  onEditUser: (user: WithId<UserProfile>) => void;
  onDeleteUser: (user: WithId<UserProfile>) => void;
}

export function UserManagementTable({
  users,
  isLoading,
  onEditUser,
  onDeleteUser,
}: UserManagementTableProps) {
  if (isLoading) {
    return <p>Loading users...</p>;
  }

  const displayUsers = users?.filter(
    (user) => user.id !== 'CKXEmQyUjmVg6gcgGwcYOHGUgNo1'
  );

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Membership</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayUsers &&
            displayUsers.map((user) => {
              const isMember = user.role === 'member';
              const expiryDate = user.membershipExpiryDate?.toDate();
              const isExpired = isMember && expiryDate && expiryDate < new Date();

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        {user.photoURL && <AvatarImage src={user.photoURL} />}
                        <AvatarFallback>{user.name ? user.name.charAt(0) : 'U'}</AvatarFallback>
                      </Avatar>
                      <span>{user.name || user.email || 'Unnamed User'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isMember ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {user.isUnlimitedMember ? 'Lifetime' : expiryDate
                            ? `Expires ${format(expiryDate, 'dd MMM yyyy')}`
                            : 'No expiry set'}
                        </span>
                        {isExpired && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Membership has expired.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditUser(user)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit User</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDeleteUser(user)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete User</span>
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
