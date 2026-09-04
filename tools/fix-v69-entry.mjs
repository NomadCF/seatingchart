import fs from 'node:fs';

function replace(file, from, to) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) throw new Error(`${file}: expected fragment not found`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

replace('src/scripts/030-interoperability-v69.js',
`      container.appendChild(button);
    }
    const moreMenu = document.getElementById('v4MoreMenu');`,
`      container.appendChild(button);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openHub();
      });
    }
    const moreMenu = document.getElementById('v4MoreMenu');`);

replace('src/scripts/030-interoperability-v69.js',
`      moreMenu.insertBefore(group, application || null);
    }
  }`,
`      moreMenu.insertBefore(group, application || null);
      group.querySelector('#openInteroperabilityV69MenuBtn')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openHub();
      });
    }
  }`);

replace('.github/workflows/ci.yml',
`node -e "for (const f of ['schemas/planner-v13.schema.json','schemas/envelope-v3.schema.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('Schemas parse cleanly.')"`,
`node -e "for (const f of ['schemas/planner-v13.schema.json','schemas/envelope-v3.schema.json','schemas/roster-import-v1.schema.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('Schemas parse cleanly.')"`);

console.log('Fixed V6.9 direct menu wiring and schema CI coverage.');
