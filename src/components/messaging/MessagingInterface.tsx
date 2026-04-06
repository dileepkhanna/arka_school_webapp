import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { Send, Loader2, MessageCircle, Check, CheckCheck, Plus, Crown, UserCheck, Paperclip, Image, Download, FileText, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
}

interface Contact {
  id: string;
  name: string;
  role: 'teacher' | 'parent' | 'admin';
  roleLabel?: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  studentId?: string;
  studentName?: string;
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  parentUserId?: string;
  parentName?: string;
}

interface TeacherOption {
  id: string;
  userId: string;
  name: string;
  teacherId: string;
}

interface Props {
  currentUserId: string;
  currentUserRole: 'teacher' | 'parent' | 'admin';
  studentId?: string;
}

export default function MessagingInterface({ currentUserId, currentUserRole, studentId }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedContactRef = useRef<Contact | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const isMobile = useIsMobile();

  // Class/Student selection for teachers and admins
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [messageType, setMessageType] = useState<'parent' | 'teacher' | 'admin'>('parent');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Teacher selection for admin
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Admin info for teacher messaging
  const [adminUser, setAdminUser] = useState<{ userId: string; name: string; avatar?: string } | null>(null);

  // Load contacts based on role
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await loadContacts({ silent: false, preserveSelection: true });

      if (currentUserRole === 'teacher' || currentUserRole === 'admin' || currentUserRole === 'parent') {
        await loadClasses();
      }
      if (currentUserRole === 'admin' || currentUserRole === 'parent') {
        await loadTeachers();
      }
      if (currentUserRole === 'teacher' || currentUserRole === 'parent') {
        await loadAdminUser();
      }

      setLoading(false);
    };

    initialize();
  }, [currentUserId, currentUserRole]);

  // Load students when class is selected
  useEffect(() => {
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    } else {
      setStudents([]);
      setSelectedStudentId('');
    }
  }, [selectedClassId]);

  // Polling fallback for new messages
  useEffect(() => {
    const timer = setInterval(() => {
      const currentContact = selectedContactRef.current;
      if (currentContact) {
        const currentMessages = messagesRef.current;
        const lastMessageId = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : undefined;
        loadMessages(currentContact, {
          selectContact: false,
          afterId: lastMessageId,
          merge: true,
          silent: true,
        });
      }
      loadContacts({ silent: true, preserveSelection: true });
    }, 2500);

    return () => clearInterval(timer);
  }, [currentUserId]);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadClasses = async () => {
    try {
      const data = await apiClient.get<ClassOption[]>('/messaging/classes');
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const teachersData = await apiClient.get<TeacherOption[]>('/messaging/teachers');
      setTeachers(teachersData || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const loadAdminUser = async () => {
    try {
      const data = await apiClient.get<{ userId: string; name: string; avatar?: string } | null>('/messaging/admin-user');
      setAdminUser(data);
    } catch (error) {
      console.error('Error loading admin user:', error);
    }
  };

  const loadStudentsForClass = async (classId: string) => {
    setLoadingStudents(true);
    try {
      const studentsData = await apiClient.get<StudentOption[]>(`/messaging/students/class/${classId}`);
      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const startNewConversation = () => {
    if (messageType === 'teacher') {
      startTeacherConversation();
    } else if (messageType === 'admin') {
      startAdminConversation();
    } else {
      startParentConversation();
    }
  };

  const startAdminConversation = () => {
    if (!adminUser) {
      toast.error('No admin found');
      return;
    }

    const newContact: Contact = {
      id: adminUser.userId,
      name: adminUser.name,
      role: 'admin',
      roleLabel: 'Principal',
      avatar: adminUser.avatar,
    };

    setSelectedContact(newContact);
    setMessages([]);
    setShowNewMessage(false);
    setMessageType('parent');

    loadMessages(newContact, { selectContact: false });

    if (!contacts.find(c => c.id === newContact.id)) {
      setContacts(prev => [newContact, ...prev]);
    }
  };

  const startParentConversation = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student || !student.parentUserId) {
      toast.error('No parent linked to this student');
      return;
    }

    const newContact: Contact = {
      id: student.parentUserId,
      name: student.parentName || `Parent of ${student.full_name}`,
      role: 'parent',
      studentId: student.id,
      studentName: student.full_name
    };

    setSelectedContact(newContact);
    setMessages([]);
    setShowNewMessage(false);
    setSelectedClassId('');
    setSelectedStudentId('');
    loadMessages(newContact, { selectContact: false });

    // Add to contacts if not already there
    if (!contacts.find(c => c.id === newContact.id && c.studentId === newContact.studentId)) {
      setContacts(prev => [newContact, ...prev]);
    }
  };

  const startTeacherConversation = () => {
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) {
      toast.error('Please select a teacher');
      return;
    }

    const newContact: Contact = {
      id: teacher.userId,
      name: teacher.name,
      role: 'teacher',
      roleLabel: `ID: ${teacher.teacherId}`
    };

    setSelectedContact(newContact);
    setMessages([]);
    setShowNewMessage(false);
    setSelectedTeacherId('');
    setMessageType('parent');

    // Load existing messages with this teacher
    loadMessages(newContact, { selectContact: false });

    // Add to contacts if not already there
    if (!contacts.find(c => c.id === newContact.id)) {
      setContacts(prev => [newContact, ...prev]);
    }
  };

  const loadContacts = async (options?: { silent?: boolean; preserveSelection?: boolean }) => {
    const silent = options?.silent ?? false;
    const preserveSelection = options?.preserveSelection ?? false;
    if (!silent) setLoading(true);

    try {
      const data = await apiClient.get<Contact[]>('/messaging/contacts');
      const nextContacts = data || [];
      setContacts((prev) => {
        if (prev.length === nextContacts.length) {
          const same = prev.every((p, idx) => {
            const n = nextContacts[idx];
            return n && p.id === n.id && (p.studentId || null) === (n.studentId || null) && p.name === n.name;
          });
          if (same) return prev;
        }
        return nextContacts;
      });

      if (preserveSelection && selectedContact) {
        const matched = nextContacts.find(
          (c) => c.id === selectedContact.id && (c.studentId || null) === (selectedContact.studentId || null),
        );
        if (matched) {
          setSelectedContact(matched);
        }
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (
    contact: Contact,
    options?: { selectContact?: boolean; afterId?: string; merge?: boolean; silent?: boolean },
  ) => {
    const selectContact = options?.selectContact ?? true;
    const afterId = options?.afterId;
    const merge = options?.merge ?? false;
    if (selectContact) {
      setSelectedContact(contact);
      setShowNewMessage(false);
    }
    
    try {
      const params = new URLSearchParams();
      params.set('contact_id', contact.id);
      if (contact.studentId) params.set('student_id', contact.studentId);
      if (afterId) params.set('after_id', afterId);
      const data = await apiClient.get<Message[]>(`/messaging/messages?${params.toString()}`);

      if (data) {
        setMessages((prev) => {
          if (!merge) return data;
          if (data.length === 0) return prev;
          const existing = new Set(prev.map((m) => m.id));
          const additions = data.filter((m) => !existing.has(m.id));
          if (additions.length === 0) return prev;
          return [...prev, ...additions];
        });
        const unreadIds = data
          .filter(m => m.recipient_id === currentUserId && !m.is_read)
          .map(m => m.id);
        
        if (unreadIds.length > 0) {
          await Promise.all(unreadIds.map((id) => apiClient.put(`/messaging/messages/${id}/read`)));
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markAsRead = async (messageId: string) => {
    await apiClient.put(`/messaging/messages/${messageId}/read`);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachmentFile) || !selectedContact) return;
    
    setSending(true);
    const contactSnapshot = selectedContact;
    try {
      if (attachmentFile) {
        setUploading(true);

        const form = new FormData();
        form.append('recipient_id', contactSnapshot.id);
        if (contactSnapshot.studentId) form.append('student_id', contactSnapshot.studentId);
        form.append('content', newMessage.trim());
        form.append('attachment', attachmentFile);
        await apiClient.postForm('/messaging/messages', form);
        setUploading(false);
      } else {
        await apiClient.post('/messaging/messages', {
          recipient_id: contactSnapshot.id,
          student_id: contactSnapshot.studentId || null,
          content: newMessage.trim(),
        });
      }

      setNewMessage('');
      setAttachmentFile(null);

      // Reload full message list without changing selected contact (avoids re-render flicker)
      await loadMessages(contactSnapshot, { selectContact: false });
      // Also refresh contacts to update last-message preview
      loadContacts({ silent: true, preserveSelection: true });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setUploading(false);
    } finally {
      setSending(false);
    }
  };


  const getRoleIcon = (contact: Contact) => {
    if (contact.roleLabel === 'Principal' || contact.role === 'admin') {
      return <Crown className="h-3 w-3 text-amber-500" />;
    }
    if (contact.roleLabel === 'Class Teacher') {
      return <UserCheck className="h-3 w-3 text-primary" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] md:h-[600px]">
      {/* Contacts List - hidden on mobile when a contact is selected */}
      <Card className={`md:col-span-1 ${isMobile && selectedContact ? 'hidden' : ''}`}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Conversations
            </CardTitle>
            {(currentUserRole === 'teacher' || currentUserRole === 'admin' || currentUserRole === 'parent') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewMessage(!showNewMessage)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* New Message Picker for Teachers/Admins */}
          {showNewMessage && (currentUserRole === 'teacher' || currentUserRole === 'admin') && (
            <div className="p-3 border-b space-y-3 bg-muted/30">
              {/* Role-based message type toggle */}
              {(currentUserRole === 'admin' || currentUserRole === 'teacher') && (
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <Button
                    size="sm"
                    variant={messageType === 'parent' ? 'default' : 'ghost'}
                    className="flex-1 h-7 text-xs"
                    onClick={() => {
                      setMessageType('parent');
                      setSelectedTeacherId('');
                    }}
                  >
                    Parent
                  </Button>
                  {currentUserRole === 'admin' && (
                    <Button
                      size="sm"
                      variant={messageType === 'teacher' ? 'default' : 'ghost'}
                      className="flex-1 h-7 text-xs"
                      onClick={() => {
                        setMessageType('teacher');
                        setSelectedClassId('');
                        setSelectedStudentId('');
                      }}
                    >
                      Teacher
                    </Button>
                  )}
                  {currentUserRole === 'teacher' && (
                    <Button
                      size="sm"
                      variant={messageType === 'admin' ? 'default' : 'ghost'}
                      className="flex-1 h-7 text-xs"
                      onClick={() => {
                        setMessageType('admin');
                        setSelectedClassId('');
                        setSelectedStudentId('');
                      }}
                    >
                      Admin
                    </Button>
                  )}
                </div>
              )}

              {/* Admin message for teacher */}
              {currentUserRole === 'teacher' && messageType === 'admin' && (
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={startNewConversation}
                  disabled={!adminUser}
                >
                  {adminUser ? `Message ${adminUser.name}` : 'No admin available'}
                </Button>
              )}

              {/* Teacher selection for admin */}
              {currentUserRole === 'admin' && messageType === 'teacher' && (
                <>
                  <Select 
                    value={selectedTeacherId} 
                    onValueChange={setSelectedTeacherId}
                    disabled={loadingTeachers}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={loadingTeachers ? "Loading..." : "Select Teacher"} />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.teacherId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedTeacherId && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={startNewConversation}
                    >
                      Message Teacher
                    </Button>
                  )}
                </>
              )}

              {/* Class/Student selection for parent messaging */}
              {((currentUserRole === 'teacher' && messageType === 'parent') || (currentUserRole === 'admin' && messageType === 'parent')) && (
                <>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.section ? `${c.name} - ${c.section}` : c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedClassId && (
                    <Select 
                      value={selectedStudentId} 
                      onValueChange={setSelectedStudentId}
                      disabled={loadingStudents}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={loadingStudents ? "Loading..." : "Select Student"} />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(s => (
                          <SelectItem key={s.id} value={s.id} disabled={!s.parentUserId}>
                            {s.full_name} {!s.parentUserId && "(No parent linked)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {selectedStudentId && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={startNewConversation}
                    >
                      Message Parent
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* New Message Picker for Parents */}
          {showNewMessage && currentUserRole === 'parent' && (
            <div className="p-3 border-b space-y-3 bg-muted/30">
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <Button
                  size="sm"
                  variant={messageType === 'teacher' ? 'default' : 'ghost'}
                  className="flex-1 h-7 text-xs"
                  onClick={() => setMessageType('teacher')}
                >
                  Teacher
                </Button>
                <Button
                  size="sm"
                  variant={messageType === 'admin' ? 'default' : 'ghost'}
                  className="flex-1 h-7 text-xs"
                  onClick={() => setMessageType('admin')}
                >
                  Admin
                </Button>
              </div>

              {messageType === 'admin' && (
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    if (!adminUser) { toast.error('No admin available'); return; }
                    const newContact: Contact = {
                      id: adminUser.userId,
                      name: adminUser.name,
                      role: 'admin',
                      roleLabel: 'Principal',
                      avatar: adminUser.avatar,
                    };
                    setSelectedContact(newContact);
                    setMessages([]);
                    setShowNewMessage(false);
                     loadMessages(newContact, { selectContact: false });
                    if (!contacts.find(c => c.id === newContact.id)) {
                      setContacts(prev => [newContact, ...prev]);
                    }
                  }}
                  disabled={!adminUser}
                >
                  {adminUser ? `Message ${adminUser.name}` : 'No admin available'}
                </Button>
              )}

              {messageType === 'teacher' && (
                <>
                  <Select 
                    value={selectedTeacherId} 
                    onValueChange={setSelectedTeacherId}
                    disabled={loadingTeachers}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={loadingTeachers ? "Loading..." : "Select Teacher"} />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.teacherId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedTeacherId && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        const teacher = teachers.find(t => t.id === selectedTeacherId);
                        if (!teacher) return;
                        const newContact: Contact = {
                          id: teacher.userId,
                          name: teacher.name,
                          role: 'teacher',
                          roleLabel: `ID: ${teacher.teacherId}`,
                        };
                        setSelectedContact(newContact);
                        setMessages([]);
                        setShowNewMessage(false);
                        setSelectedTeacherId('');
                         loadMessages(newContact, { selectContact: false });
                        if (!contacts.find(c => c.id === newContact.id)) {
                          setContacts(prev => [newContact, ...prev]);
                        }
                      }}
                    >
                      Message Teacher
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          <ScrollArea className="h-[calc(100vh-320px)] sm:h-[500px]">
            {contacts.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No contacts available</p>
                <p className="text-xs mt-1">Use + to start a new conversation</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {contacts.map((contact, index) => (
                  <div
                    key={`${contact.id}-${contact.studentId || index}`}
                    onClick={() => loadMessages(contact, { selectContact: true })}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedContact?.id === contact.id && selectedContact?.studentId === contact.studentId
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback>
                        {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-sm truncate">{contact.name}</p>
                        {getRoleIcon(contact)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.roleLabel || (contact.studentName ? `Re: ${contact.studentName}` : contact.role)}
                      </p>
                    </div>
                    {contact.unreadCount && contact.unreadCount > 0 && (
                      <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {contact.unreadCount}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className={`md:col-span-2 flex flex-col ${isMobile && !selectedContact ? 'hidden' : ''}`}>
        {selectedContact ? (
          <>
            <CardHeader className="py-3 border-b">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => setSelectedContact(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedContact.avatar} />
                  <AvatarFallback>
                    {selectedContact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base truncate">{selectedContact.name}</CardTitle>
                    {getRoleIcon(selectedContact)}
                    {selectedContact.roleLabel && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedContact.roleLabel}
                      </Badge>
                    )}
                  </div>
                  {selectedContact.studentName && (
                    <p className="text-xs text-muted-foreground">
                      Regarding: {selectedContact.studentName}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isSender = message.sender_id === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 ${
                            isSender
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm'
                          }`}
                        >
                          {message.attachment_url && message.attachment_type === 'image' && (
                            <div className="mb-2">
                              <img src={message.attachment_url} alt="Shared image" className="rounded-lg max-w-full max-h-48 object-cover cursor-pointer" onClick={() => window.open(message.attachment_url!, '_blank')} />
                            </div>
                          )}
                          {message.attachment_url && message.attachment_type === 'document' && (
                            <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 mb-2 p-2 rounded-lg ${isSender ? 'bg-primary-foreground/10' : 'bg-background/50'}`}>
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="text-xs underline">Download Document</span>
                              <Download className="h-3 w-3 shrink-0" />
                            </a>
                          )}
                          {message.content && !(message.content === '📷 Image' || message.content === '📎 Document') && (
                            <p className="text-sm">{message.content}</p>
                          )}
                          <div className={`flex items-center gap-1 mt-1 ${isSender ? 'justify-end' : ''}`}>
                            <span className="text-[10px] opacity-70">
                              {format(new Date(message.created_at), 'HH:mm')}
                            </span>
                            {isSender && (
                              message.is_read 
                                ? <CheckCheck className="h-3 w-3 opacity-70" />
                                : <Check className="h-3 w-3 opacity-70" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-2 sm:p-4 border-t">
                {attachmentFile && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate flex-1">{attachmentFile.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setAttachmentFile(null)}>✕</Button>
                  </div>
                )}
                <div className="flex gap-1.5 sm:gap-2">
                  <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.heic,.heif,image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => { setAttachmentFile(e.target.files?.[0] || null); e.target.value = ''; }} />
                  <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 sm:h-10 sm:w-10" onClick={() => fileInputRef.current?.click()} disabled={sending}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={sending}
                    className="h-9 sm:h-10 text-sm"
                  />
                  <Button onClick={sendMessage} disabled={sending || (!newMessage.trim() && !attachmentFile)} className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 p-0">
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm">Choose a contact to start messaging</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
