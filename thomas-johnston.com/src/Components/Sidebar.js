import React from 'react';
import { slide as Menu } from 'react-burger-menu';
import '../Styles/Sidebar.css';

const name = props => {
  return (
    <Menu right>
      <a className="menu-item" href="/">
        Home
      </a>
      <a className="menu-item" href="/contact">
        Contact
      </a>
    </Menu>
  );
};

export default name;