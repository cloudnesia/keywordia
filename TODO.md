# Project TODOs

## Immediate Tasks
- [x] **Error Handling**: Add comprehensive error boundaries and toast notifications for failed API operations and network errors.
- [ ] **Editor Enhancements**:
    - [x] **Collaboration**: Real-time collaborative editing using WebSockets (e.g., Socket.io, PartyKit, or simple polling). (Partially done: Shared editing permissions enabled)
    - [x] Add keyboard shortcuts (Enter for sibling, Tab for child, Delete to remove).
    - [x] Support drag-and-drop reordering of nodes.
    - [ ] Zoom and pan capabilities for larger maps.
    - [x] after click new node, the new node should be focused.
    - [x] **Export Options**: Export maps to PDF, PNG, or Markdown/Text outline.

## Bug
- [x] Collaboration not need invite collaborator, just share link to collaborate.
- [x] Collaboration not work, when i open the same map in two different browser, the changes are not reflected in the other browser. it shold work same for editing colaboration between user

## Future Improvements
- [ ] **Data Validation**: Implement strict schema validation (e.g., Zod) for the `MindMap.content` JSON blob to prevent data corruption.
- [ ] **Theming**: User-customizable themes for map nodes (colors, fonts).
- [ ] **Offline Support**: LocalStorage caching for offline editing and sync when online.
- [ ] **Testing**: Add end-to-end tests with Playwright to verify critical flows (Login, Create Map, Edit Node).
