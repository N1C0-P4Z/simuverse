import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de roles y funcionalidades...');

  // Roles
  const rolesData = [
    { name: 'admin', description: 'Administrador del sistema', color: '#EF4444' },
    { name: 'teacher', description: 'Profesor o Docente', color: '#3B82F6' },
    { name: 'student', description: 'Alumno', color: '#10B981' },
    { name: 'ministerio', description: 'Auditor del Ministerio', color: '#8B5CF6' },
  ];

  for (const r of rolesData) {
    await prisma.role.upsert({
      where: { id: rolesData.indexOf(r) + 1 }, // Simple ID logic for seed
      update: r,
      create: { id: rolesData.indexOf(r) + 1, ...r },
    });
  }
  console.log('✅ Roles creados');

  // System Functionalities (25 codes)
  // Always upsert by `code` (the @unique field) — never by hardcoded id.
  // This is safe on both fresh DBs (CI) and existing deployments:
  //   - fresh DB: INSERT, SERIAL assigns ids automatically, no conflict.
  //   - existing DB: ON CONFLICT (code) DO UPDATE, existing row updated in place.
  const functionalitiesData = [
    { name: 'Gestión de Usuarios', code: 'users.manage', description: 'Permite administrar usuarios', module: 'Usuarios', route: '/admin/users' },
    { name: 'Configuración de Roles', code: 'rbac.manage', description: 'Permite configurar roles y permisos', module: 'Seguridad', route: '/admin/roles' },
    { name: 'Gestión de Cursos', code: 'courses.manage', description: 'Creación y edición de cursos', module: 'Académico', route: '/admin/courses' },
    { name: 'Reportes', code: 'reports.read', description: 'Ver reportes del sistema', module: 'Reportes', route: '/admin/reports' },
    { name: 'Lectura de Usuarios', code: 'users.read', description: 'Ver listado de usuarios', module: 'Usuarios', route: '/admin/users' },
    { name: 'Lectura de Cursos', code: 'courses.read', description: 'Ver cursos disponibles', module: 'Académico', route: '/admin/courses' },
    { name: 'Lectura de Escenarios', code: 'scenarios.read', description: 'Ver escenarios de práctica', module: 'Académico', route: '/admin/scenarios' },
    { name: 'Gestión de Escenarios', code: 'scenarios.manage', description: 'Crear y editar escenarios', module: 'Académico', route: '/admin/scenarios' },
    { name: 'Lectura de Simulaciones', code: 'simulations.read', description: 'Ver historial de simulaciones', module: 'Simulaciones', route: '/admin/simulations' },
    { name: 'Gestión de Catálogo', code: 'catalog.manage', description: 'Administrar catálogo de cursos', module: 'Catálogo', route: '/admin/catalog' },
    { name: 'Lectura de Documentos', code: 'documents.read', description: 'Ver documentos del curso', module: 'Documentos', route: '/admin/documents' },
    { name: 'Gestión de Documentos', code: 'documents.manage', description: 'Crear y editar documentos', module: 'Documentos', route: '/admin/documents' },
    { name: 'Lectura de Asignaciones', code: 'assignments.read', description: 'Ver asignaciones de cursos', module: 'Asignaciones', route: '/admin/assignments' },
    { name: 'Gestión de Asignaciones', code: 'assignments.manage', description: 'Crear y editar asignaciones', module: 'Asignaciones', route: '/admin/assignments' },
    { name: 'Lectura de Plantillas', code: 'templates.read', description: 'Ver plantillas de prompts', module: 'Plantillas', route: '/admin/templates' },
    { name: 'Gestión de Plantillas', code: 'templates.manage', description: 'Crear y editar plantillas', module: 'Plantillas', route: '/admin/templates' },
    { name: 'Gestión de Empresas', code: 'companies.manage', description: 'Administrar empresas simuladas', module: 'Empresas', route: '/admin/companies' },
    { name: 'Lectura del Ministerio', code: 'ministry.read', description: 'Ver datos del ministerio', module: 'Ministerio', route: '/admin/ministry' },
    { name: 'Gestión del Ministerio', code: 'ministry.manage', description: 'Administrar requisitos del ministerio', module: 'Ministerio', route: '/admin/ministry' },
    { name: 'Gestión de Notificaciones', code: 'notifications.manage', description: 'Administrar notificaciones del sistema', module: 'Notificaciones', route: '/admin/notifications' },
    { name: 'Lectura de Archivos', code: 'files.read', description: 'Ver archivos subidos', module: 'Archivos', route: '/admin/files' },
    { name: 'Subida de Archivos', code: 'files.upload', description: 'Subir archivos al sistema', module: 'Archivos', route: '/admin/files' },
    { name: 'Gestión de Archivos', code: 'files.manage', description: 'Administrar archivos del sistema', module: 'Archivos', route: '/admin/files' },
    { name: 'Lectura de Evaluaciones', code: 'assessments.read', description: 'Ver evaluaciones de simulaciones', module: 'Evaluaciones', route: '/admin/assessments' },
    { name: 'Creación de Evaluaciones', code: 'assessments.create', description: 'Crear evaluaciones de simulaciones', module: 'Evaluaciones', route: '/admin/assessments' },
  ];

  for (const f of functionalitiesData) {
    const { name, code, description, module: mod, route } = f;
    await prisma.systemFunctionality.upsert({
      where: { code },
      update: { name, description, module: mod, route },
      create: { name, code, description, module: mod, route },
    });
  }
  console.log(`✅ ${functionalitiesData.length} funcionalidades creadas`);

  // Asignar permisos básicos (Admin tiene todo habilitado)
  const allRoles = await prisma.role.findMany();
  const allFuncs = await prisma.systemFunctionality.findMany();
  
  for (const role of allRoles) {
    for (const func of allFuncs) {
      await prisma.rolePermission.upsert({
        where: { role_name_functionality_id: { role_name: role.name, functionality_id: func.id } },
        update: {}, // no sobrescribir enabled en filas existentes (RBAC customizado)
        create: { role_name: role.name, functionality_id: func.id, enabled: role.name === 'admin' },
      });
    }
  }
  console.log('✅ Permisos básicos asignados');

  console.log('🌱 Iniciando seed de usuarios...');

  // Contraseña por defecto para todos los usuarios
  const defaultPassword = await bcrypt.hash('Admin123!', 10);
  const coursePassword = await bcrypt.hash('Curso2026!', 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@simuverse.edu' },
    update: {},
    create: {
      id: 'admin-001',
      email: 'admin@simuverse.edu',
      name: 'Administrador SimuVerse',
      password_hash: defaultPassword,
      role: 'admin',
    },
  });
  console.log('✅ Admin creado:', admin.email);

  // Profesores
  const teacher1 = await prisma.user.upsert({
    where: { email: 'garcia@simuverse.edu' },
    update: {},
    create: {
      id: 'prof-001',
      email: 'garcia@simuverse.edu',
      name: 'Prof. García',
      password_hash: defaultPassword,
      role: 'teacher',
    },
  });
  console.log('✅ Profesor 1 creado:', teacher1.email);

  const teacher2 = await prisma.user.upsert({
    where: { email: 'martinez@simuverse.edu' },
    update: {},
    create: {
      id: 'prof-002',
      email: 'martinez@simuverse.edu',
      name: 'Prof. Martínez',
      password_hash: defaultPassword,
      role: 'teacher',
    },
  });
  console.log('✅ Profesor 2 creado:', teacher2.email);

  // Estudiantes
  const student1 = await prisma.user.upsert({
    where: { email: 'juan.perez@student.edu' },
    update: {},
    create: {
      id: 'stud-001',
      email: 'juan.perez@student.edu',
      name: 'Juan Pérez',
      password_hash: defaultPassword,
      role: 'student',
    },
  });
  console.log('✅ Estudiante 1 creado:', student1.email);

  const student2 = await prisma.user.upsert({
    where: { email: 'maria.lopez@student.edu' },
    update: {},
    create: {
      id: 'stud-002',
      email: 'maria.lopez@student.edu',
      name: 'María López',
      password_hash: defaultPassword,
      role: 'student',
    },
  });
  console.log('✅ Estudiante 2 creado:', student2.email);

  const student3 = await prisma.user.upsert({
    where: { email: 'carlos.soto@student.edu' },
    update: {},
    create: {
      id: 'stud-003',
      email: 'carlos.soto@student.edu',
      name: 'Carlos Soto',
      password_hash: defaultPassword,
      role: 'student',
    },
  });
  console.log('✅ Estudiante 3 creado:', student3.email);

  // Auditor del Ministerio
  const ministerio = await prisma.user.upsert({
    where: { email: 'control@ministerio.gob' },
    update: {},
    create: {
      id: 'min-001',
      email: 'control@ministerio.gob',
      name: 'Control Ministerio',
      password_hash: defaultPassword,
      role: 'ministerio',
    },
  });
  console.log('✅ Auditor Ministerio creado:', ministerio.email);

  // ──────────────────────────────────────────────────────────
  // Empresa Ficticia
  // ──────────────────────────────────────────────────────────
  console.log('🏢 Creando empresa ficticia...');
  // Upsert by unique name — where: { id: 1 } breaks with P2002 when the
  // company already exists under a different autoincrement id.
  const company = await prisma.simulatedCompany.upsert({
    where: { name: 'Administración Las Tradiciones' },
    update: {
      short_name: 'Las Tradiciones',
      description: 'Empresa de servicios administrativos y contables',
    },
    create: {
      name: 'Administración Las Tradiciones',
      short_name: 'Las Tradiciones',
      description: 'Empresa de servicios administrativos y contables',
    },
  });

  // ──────────────────────────────────────────────────────────
  // Curso y Configuración
  // ──────────────────────────────────────────────────────────
  console.log('📚 Creando curso "Ofimática Básica"...');
  const course = await prisma.course.upsert({
    where: { course_id: 'OFI-BAS-001' },
    update: {
      modules: ["chat_ia", "email_simulado", "documentos", "hoja_calculo", "crisis_engine"],
      password_hash: coursePassword,
    },
    create: {
      id: 'course-ofimatica-001',
      course_id: 'OFI-BAS-001',
      title: 'Ofimática Básica para Empleado de Oficina',
      description: 'Simulación interactiva de ofimática en entorno administrativo real',
      category: 'administracion',
      modules: ["chat_ia", "email_simulado", "documentos", "hoja_calculo", "crisis_engine"],
      is_active: true,
      password_hash: coursePassword,
    },
  });

  await prisma.courseSimulatedCompany.upsert({
    where: { course_id_simulated_company_id: { course_id: course.id, simulated_company_id: company.id } },
    update: {},
    create: { course_id: course.id, simulated_company_id: company.id },
  });

  await prisma.courseConfig.upsert({
    where: { course_id: course.id },
    update: {},
    create: {
      course_id: course.id,
      config_data: {},
      base_role: 'Eres el compañero de trabajo de Juan en Administración Las Tradiciones. Te llamas Carlos. Estás necesitando ayuda con una fórmula de Excel para liquidar sueldos.',
      course_context: 'Juan es un empleado nuevo en Administración Las Tradiciones, una empresa de servicios administrativos en Rosario. Está en su primer día y debe ayudar con tareas de oficina.',
      personality_traits: ["amigable", "paciente", "práctico", "orientado a resultados"],
      knowledge_base_prompt: 'Si Juan pide ayuda con Excel, guialo paso a paso. Si se equivoca, corregilo con paciencia. Si se sale del rol, recordale el contexto.',
      active_modules: ["chat_ia", "email_simulado", "documentos", "hoja_calculo", "crisis_engine"],
      family_type: 'administration',
    },
  });

  // ──────────────────────────────────────────────────────────
  // Escenario
  // ──────────────────────────────────────────────────────────
  console.log('🎬 Creando escenario "Primer Día"...');
  const scenario = await prisma.scenario.upsert({
    where: { id: 'scenario-primer-dia-001' },
    update: {
      scenario_type: 'practice',
      sequence_index: 1,
      agent_key: 'practica-1',
    },
    create: {
      id: 'scenario-primer-dia-001',
      course_id: course.id,
      title: 'Primer Día en Administración Las Tradiciones',
      description: 'Tu primer día como empleado de oficina. Tu compañero Carlos necesita ayuda con una planilla de sueldos.',
      scenario_type: 'practice',
      sequence_index: 1,
      agent_key: 'practica-1',
      difficulty: 'easy',
      content: {
        context: 'Es lunes por la mañana. Estás en tu escritorio. Tu compañero Carlos se acerca con una planilla de Excel y te pide ayuda.',
        student_data: {
          nombre: 'Juan Pérez',
          rol: 'Empleado nuevo',
          empresa: 'Administración Las Tradiciones'
        },
        emails: [
          {
            id: 1,
            from: 'Jefe de Administración',
            subject: 'Reunión del viernes — armar minuta',
            body: 'Juan, necesito que armes la minuta de la reunión del viernes pasado. Te adjunto las notas. Formato estándar de la empresa.',
            date: new Date().toISOString(),
            read: false
          },
          {
            id: 2,
            from: 'Proveedor OfficeMax',
            subject: 'Confirmación de envío',
            body: 'Su pedido de 20 resmas de papel A4 fue despachado. Llega el miércoles. N° de seguimiento: OM-2024-7891.',
            date: new Date().toISOString(),
            read: false
          },
          {
            id: 3,
            from: 'Jefe de Administración (URGENTE)',
            subject: 'Error en liquidación de sueldos',
            body: 'URGENTE: El sistema procesó mal el coeficiente de aportes. 47 empleados afectados. Necesitamos reliquidación inmediata.',
            date: new Date().toISOString(),
            read: false,
            isUrgent: true
          }
        ],
        spreadsheet: {
          name: "Liquidación de Sueldos — Noviembre 2024",
          data: [
            { item: "Sueldo base", value: 450000, currency: "ARS" },
            { item: "Horas extra (10hs)", value: 28000, currency: "ARS" },
            { item: "Aportes jubilatorios (17%)", value: 81060, currency: "ARS" },
            { item: "Obra social (6%)", value: 28620, currency: "ARS" },
            { item: "Total bruto", value: 478000, currency: "ARS" },
            { item: "Descuento ART (1.5%)", value: 7170, currency: "ARS" },
            { item: "Neto a cobrar", value: 470830, currency: "ARS" }
          ],
          formulas: {
            "Aportes": "= Sueldo base × 17%",
            "Obra Social": "= Sueldo base × 6%",
            "ART": "= Sueldo base × 1.5%",
            "Neto": "= Sueldo base + Horas extra - Aportes - Obra Social - ART"
          }
        }
      },
      expected_outcomes: {
        main_objective: 'Ayudar a Carlos con la fórmula de Excel, responder los emails del jefe y resolver la crisis de liquidación.'
      }
    }
  });

  // ──────────────────────────────────────────────────────────
  // Documentos
  // ──────────────────────────────────────────────────────────
  console.log('📄 Subiendo documentos pre-cargados...');
  await prisma.courseDocument.deleteMany({
    where: { course_id: course.id }
  });
  await prisma.courseDocument.createMany({
    data: [
      {
        course_id: course.id,
        document_name: 'Minuta Reunión 2024-11-15',
        document_type: 'procedure',
        document_content: 'ORDEN DEL DÍA: 1. Revisión de presupuesto Q4. 2. Liquidación de sueldos. 3. Capacitación del equipo.',
      },
      {
        course_id: course.id,
        document_name: 'Contrato Proveedor OfficeMax',
        document_type: 'contract',
        document_content: 'Contrato de suministro de material de oficina. Vigencia: 01/01/2024 — 31/12/2024. Condiciones de pago: 30 días.',
      }
    ]
  });

  // ──────────────────────────────────────────────────────────
  // Asignación de Curso y Permisos
  // ──────────────────────────────────────────────────────────
  console.log('📝 Asignando simulación a Juan Pérez...');
  const existingAssignment = await prisma.simulationAssignment.findFirst({
    where: { student_id: student1.id, course_id: course.id }
  });
  
  if (!existingAssignment) {
    await prisma.simulationAssignment.create({
      data: {
        simulation_id: `sim-${student1.id}`,
        student_id: student1.id,
        course_id: course.id,
        assigned_by: admin.id,
        status: 'in_progress'
      }
    });
  }

  // Ensure simulation record exists for endpoints to work properly
  const sim = await prisma.simulation.findFirst({
    where: { student_id: student1.id, course_id: course.id }
  });
  if (!sim) {
    await prisma.simulation.create({
      data: {
        student_id: student1.id,
        course_id: course.id,
        status: 'active'
      }
    });
  }

  // Docentes asociados al curso
  await prisma.courseTeacher.upsert({
    where: { course_id_teacher_id: { course_id: course.id, teacher_id: teacher1.id } },
    update: {},
    create: { course_id: course.id, teacher_id: teacher1.id },
  });

  // Términos y condiciones iniciales
  const existingTerms = await prisma.termsVersion.findFirst({ where: { is_current: true } });
  if (!existingTerms) {
    await prisma.termsVersion.create({
      data: {
        version: '1.0',
        title: 'Términos y Condiciones de SimuVerse',
        content:
          'Al usar SimuVerse aceptás el uso de la plataforma con fines educativos, el registro de sesiones de práctica y el tratamiento de datos conforme a la política institucional.',
        is_current: true,
        published_at: new Date(),
      },
    });
    console.log('✅ Términos y condiciones v1.0 publicados');
  }

  // Sync seed users to Firebase when Admin credentials are present (optional; skip on failure)
  try {
    const { resolveFirebaseCredentials } = await import('../auth/firebase-credentials');
    const firebaseCredentials = resolveFirebaseCredentials();
    if (firebaseCredentials) {
      const { cert, getApps, initializeApp } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      if (!getApps().length) {
        initializeApp({
          credential: cert(firebaseCredentials),
        });
      }
      const seedUsers = [admin, teacher1, teacher2, student1, student2, student3, ministerio];
      for (const u of seedUsers) {
        try {
          let fb;
          try {
            fb = await getAuth().getUserByEmail(u.email);
          } catch {
            fb = await getAuth().createUser({
              uid: u.id,
              email: u.email,
              password: 'Admin123!',
              displayName: u.name,
              emailVerified: true,
            });
          }
          await prisma.user.update({
            where: { id: u.id },
            data: { firebase_uid: fb.uid },
          });
        } catch (err: any) {
          console.warn(`⚠️ Firebase sync skipped for ${u.email}:`, err?.message || err);
        }
      }
      console.log('✅ Usuarios seed sincronizados con Firebase');
    } else {
      console.log('ℹ️ Firebase Admin no configurado — seed sin sync de usuarios');
    }
  } catch (err: any) {
    console.warn('⚠️ Firebase sync skipped in seed:', err?.message || err);
  }

  const { CourseRubricService } = await import('../rubrics/course-rubric.service');
  const rubricService = new CourseRubricService(prisma as any);
  const allCourses = await prisma.course.findMany({ select: { id: true, title: true } });
  for (const c of allCourses) {
    await rubricService.cloneDefaultRubricToCourse(c.id);
  }
  console.log(`✅ Rúbricas base clonadas para ${allCourses.length} curso(s)`);

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📋 Credenciales de acceso:');
  console.log('   Email: admin@simuverse.edu | Password: Admin123!');
  console.log('   Email: garcia@simuverse.edu | Password: Admin123!');
  console.log('   Email: martinez@simuverse.edu | Password: Admin123!');
  console.log('   Email: juan.perez@student.edu | Password: Admin123!');
  console.log('   Email: maria.lopez@student.edu | Password: Admin123!');
  console.log('   Email: carlos.soto@student.edu | Password: Admin123!');
  console.log('   Email: control@ministerio.gob | Password: Admin123!');
  console.log('   Curso OFI-BAS-001 password: Curso2026!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
