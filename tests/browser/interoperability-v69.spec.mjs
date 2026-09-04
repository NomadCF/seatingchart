import { test, expect } from '@playwright/test';

async function completeFreshSecuritySetupIfNeeded(page) {
  const modal = page.locator('#welcomeSecurityModal.show');
  if (await modal.count() === 0) return;
  const passphrase = 'browser regression secure classroom passphrase 2026';
  await page.locator('#welcomeEncryptionKeyInput').fill(passphrase);
  await page.locator('#welcomeEncryptionKeyConfirmInput').fill(passphrase);
  await page.locator('#welcomeSecurityStartBtn').click();
  await expect(page.locator('#welcomeSecurityModal')).not.toHaveClass(/\bshow\b/, { timeout: 15000 });
}

async function closeAutomaticGettingStartedIfNeeded(page) {
  const modal = page.locator('#gettingStartedModal');
  try { await expect(modal).toHaveClass(/\bshow\b/, { timeout: 4000 }); }
  catch (_) { return; }
  await page.locator('#gettingStartedCloseBtn').click();
  await expect(modal).not.toHaveClass(/\bshow\b/, { timeout: 10000 });
}

async function ready(page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);
}

test('V6.9 roster interoperability is reachable and normalizes matching safely', async ({ page }) => {
  await ready(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '6.9.0');
  await page.locator('#v4MoreMenuBtn').click();
  await expect(page.locator('#openInteroperabilityV69MenuBtn')).toBeVisible();
  await page.locator('#openInteroperabilityV69MenuBtn').click();
  await expect(page.locator('#interopV69Modal')).toHaveClass(/\bshow\b/);
  await expect(page.getByText('OneRoster 1.2 CSV')).toBeVisible();
  await expect(page.getByText('Microsoft Education')).toBeVisible();

  const result = await page.evaluate(() => {
    state.students = [
      normalizeStudent({ id:'internal-a', firstName:'Avery', lastName:'Stone', grade:'5', sourceSystem:'sis-csv', sourceUserId:'A-100', sourceIdentifiers:{ externalId:'A-100', email:'avery@example.edu' }, notesPrivate:'keep me', requirements:{ aisle:true } }),
      normalizeStudent({ id:'internal-b', firstName:'Morgan', lastName:'Reed', grade:'5', sourceSystem:'sis-csv', sourceUserId:'B-200', sourceIdentifiers:{ externalId:'B-200', email:'morgan@example.edu' } }),
      normalizeStudent({ id:'internal-c', firstName:'Taylor', lastName:'Lane', grade:'5' })
    ];
    const plan = window.InteroperabilityV69.buildReconciliation([
      { externalId:'A-100', firstName:'Avery', lastName:'Stone', grade:'6', email:'avery@example.edu', sourceSystem:'sis-csv' },
      { externalId:'NEW-1', firstName:'Jordan', lastName:'Pine', grade:'6', email:'jordan@example.edu', sourceSystem:'sis-csv' },
      { externalId:'DIFFERENT', firstName:'Morgan', lastName:'Reed', grade:'6', email:'morgan@example.edu', sourceSystem:'sis-csv' },
      { firstName:'Taylor', lastName:'Lane', grade:'6', sourceSystem:'sis-csv' },
      { externalId:'NEW-1', firstName:'Jordan', lastName:'Pine', grade:'6', email:'jordan@example.edu', sourceSystem:'sis-csv' }
    ], { sourceSystem:'sis-csv', label:'SIS CSV' });
    return plan.rows.map(row => ({ action:row.action, confidence:row.confidence, checked:row.checked, id:row.incoming.externalId || '' }));
  });

  expect(result).toEqual([
    expect.objectContaining({ action:'update', confidence:'stable-id', checked:true, id:'A-100' }),
    expect.objectContaining({ action:'add', confidence:'new', checked:true, id:'NEW-1' }),
    expect.objectContaining({ action:'update', confidence:'email', checked:true, id:'DIFFERENT' }),
    expect.objectContaining({ action:'review', confidence:'name', checked:false }),
    expect.objectContaining({ action:'duplicate', checked:false, id:'NEW-1' })
  ]);
});

test('V6.9 apply preserves teacher data and keeps source groups inert by default', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    state.layoutMode = 'grid';
    state.rows = 1;
    state.cols = 2;
    state.cells = {
      '1-1': { row:1, col:1, type:'seat', assignedStudentId:'internal-a', manual:true, anchorGroupIds:[], zoneIds:[] },
      '1-2': { row:1, col:2, type:'seat', assignedStudentId:null, manual:false, anchorGroupIds:[], zoneIds:[] }
    };
    state.groups = [];
    state.rosterSourceGroups = [];
    state.rosterImportHistory = [];
    state.rosterArchive = [];
    state.students = [
      normalizeStudent({ id:'internal-a', firstName:'Avery', lastName:'Stone', grade:'5', sourceSystem:'sis-csv', sourceCourseId:'course-1', sourceUserId:'A-100', sourceIdentifiers:{ externalId:'A-100', email:'avery@example.edu' }, notesPrivate:'private teacher note', notesPublic:'public note', requirements:{ aisle:true, nearTeacher:true } }),
      normalizeStudent({ id:'internal-missing', firstName:'Casey', lastName:'Old', grade:'5', sourceSystem:'sis-csv', sourceCourseId:'course-1', sourceUserId:'OLD-9', sourceIdentifiers:{ externalId:'OLD-9' } })
    ];
    window.InteroperabilityV69.reviewRecords([
      { externalId:'A-100', firstName:'Avery', lastName:'Stone', grade:'6', email:'avery@example.edu', sourceSystem:'sis-csv', sourceCourseId:'course-1' },
      { externalId:'NEW-1', firstName:'Jordan', lastName:'Pine', grade:'6', email:'jordan@example.edu', sourceSystem:'sis-csv', sourceCourseId:'course-1' }
    ], { sourceSystem:'sis-csv', label:'District SIS', sourceCourseId:'course-1', groups:[{ externalId:'reading-a', title:'Reading A', memberExternalIds:['A-100','NEW-1'] }] });
  });

  await expect(page.locator('#interopV69ReviewView')).toBeVisible();
  await expect(page.locator('#interopV69ArchiveMissing')).not.toBeChecked();
  await expect(page.locator('#interopV69SyncSourceGroups')).toBeChecked();
  await expect(page.locator('#interopV69PromoteGroups')).not.toBeChecked();
  await page.locator('#interopV69ApplyBtn').click();

  const after = await page.evaluate(() => ({
    a: state.students.find(student => student.id === 'internal-a'),
    newStudent: state.students.find(student => student.sourceUserId === 'NEW-1'),
    missingStillPresent: state.students.some(student => student.id === 'internal-missing'),
    assigned: state.cells['1-1'].assignedStudentId,
    locked: state.cells['1-1'].manual,
    sourceGroups: state.rosterSourceGroups,
    plannerGroups: state.groups,
    history: state.rosterImportHistory
  }));

  expect(after.a.grade).toBe('6');
  expect(after.a.notesPrivate).toBe('private teacher note');
  expect(after.a.notesPublic).toBe('public note');
  expect(after.a.requirements.aisle).toBeTruthy();
  expect(after.a.requirements.nearTeacher).toBeTruthy();
  expect(after.newStudent.firstName).toBe('Jordan');
  expect(after.assigned).toBe('internal-a');
  expect(after.locked).toBeTruthy();
  expect(after.missingStillPresent).toBeTruthy();
  expect(after.sourceGroups).toHaveLength(1);
  expect(after.sourceGroups[0].studentIds).toHaveLength(2);
  expect(after.plannerGroups).toHaveLength(0);
  expect(after.history).toHaveLength(1);
  expect(after.history[0]).toEqual(expect.objectContaining({ added:1, updated:1, archived:0, groupsSynced:1, groupsPromoted:0 }));
});

test('V6.9 archive and seating-group promotion remain explicit opt-ins', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    state.groups = [];
    state.rosterSourceGroups = [];
    state.rosterImportHistory = [];
    state.rosterArchive = [];
    state.students = [
      normalizeStudent({ id:'keep-a', firstName:'Avery', lastName:'Stone', sourceSystem:'sis-csv', sourceCourseId:'course-1', sourceUserId:'A-100', sourceIdentifiers:{ externalId:'A-100' } }),
      normalizeStudent({ id:'archive-me', firstName:'Casey', lastName:'Old', sourceSystem:'sis-csv', sourceCourseId:'course-1', sourceUserId:'OLD-9', sourceIdentifiers:{ externalId:'OLD-9' } })
    ];
    window.InteroperabilityV69.reviewRecords([
      { externalId:'A-100', firstName:'Avery', lastName:'Stone', sourceSystem:'sis-csv', sourceCourseId:'course-1' }
    ], { sourceSystem:'sis-csv', label:'District SIS', sourceCourseId:'course-1', groups:[{ externalId:'team-a', title:'Team A', memberExternalIds:['A-100'] }] });
  });
  await page.locator('#interopV69ArchiveMissing').check();
  await page.locator('#interopV69PromoteGroups').check();
  await page.locator('#interopV69ApplyBtn').click();
  const result = await page.evaluate(() => ({
    missingPresent: state.students.some(student => student.id === 'archive-me'),
    archived: state.rosterArchive.some(student => student.id === 'archive-me'),
    plannerGroup: state.groups[0],
    history: state.rosterImportHistory[0]
  }));
  expect(result.missingPresent).toBeFalsy();
  expect(result.archived).toBeTruthy();
  expect(result.plannerGroup).toEqual(expect.objectContaining({ name:'Team A', sourceSystem:'sis-csv', sourceCourseId:'course-1', sourceGroupId:'team-a', studentIds:['keep-a'] }));
  expect(result.history).toEqual(expect.objectContaining({ archived:1, groupsSynced:1, groupsPromoted:1 }));
});

test('V6.9 OneRoster and Microsoft CSV adapters resolve class membership', async ({ page }) => {
  await ready(page);
  const parsed = await page.evaluate(async () => {
    const oneRosterFiles = [
      new File(['sourcedId,status,enabledUser,givenName,familyName,role,identifier,email,grades,username\nu1,active,true,Avery,Stone,student,S100,avery@example.edu,6,avery\nu2,active,true,Jordan,Pine,student,S200,jordan@example.edu,6,jordan\n'], 'users.csv', { type:'text/csv' }),
      new File(['sourcedId,status,title,dateLastModified,courses,orgs,terms,grades\nc1,active,Science 6,2026-09-01,,,,6\n'], 'classes.csv', { type:'text/csv' }),
      new File(['sourcedId,status,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate,endDate\ne1,active,c1,school,u1,student,true,,\ne2,active,c1,school,u2,student,true,,\n'], 'enrollments.csv', { type:'text/csv' })
    ];
    const orSession = await window.InteroperabilityV69.parseOneRosterPackage(oneRosterFiles);
    const orData = window.InteroperabilityV69.oneRosterRecords(orSession, 'c1');

    const microsoftFiles = [
      new File(['SIS ID,First Name,Last Name,Grade,Email\nM1,Morgan,Reed,7,morgan@example.edu\nM2,Sam,River,7,sam@example.edu\n'], 'Student.csv', { type:'text/csv' }),
      new File(['SIS ID,Name\nSEC1,Math 7\n'], 'Section.csv', { type:'text/csv' }),
      new File(['Student SIS ID,Section SIS ID\nM1,SEC1\nM2,SEC1\n'], 'StudentEnrollment.csv', { type:'text/csv' })
    ];
    const msSession = await window.InteroperabilityV69.parseMicrosoftPackage(microsoftFiles);
    const msData = window.InteroperabilityV69.microsoftRecords(msSession, 'SEC1');
    return {
      oneRosterClasses: orSession.courseOptions,
      oneRosterRecords: orData.records.map(record => [record.externalId, record.firstName, record.email]),
      microsoftClasses: msSession.courseOptions,
      microsoftRecords: msData.records.map(record => [record.externalId, record.firstName, record.email])
    };
  });

  expect(parsed.oneRosterClasses).toEqual([{ id:'c1', title:'Science 6', count:2 }]);
  expect(parsed.oneRosterRecords).toEqual([['u1','Avery','avery@example.edu'],['u2','Jordan','jordan@example.edu']]);
  expect(parsed.microsoftClasses).toEqual([{ id:'SEC1', title:'Math 7', count:2 }]);
  expect(parsed.microsoftRecords).toEqual([['M1','Morgan','morgan@example.edu'],['M2','Sam','sam@example.edu']]);
});
