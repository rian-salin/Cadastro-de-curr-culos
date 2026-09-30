import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// A limpeza automática do Testing Library depende de um `afterEach` global,
// que não existe aqui (o projeto não usa `test.globals` do Vitest, para manter
// os imports explícitos nos arquivos de teste).
afterEach(cleanup)
