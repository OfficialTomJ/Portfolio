import Logo from "../Assets/logo.png"

import React from "react";
import {
  Link
} from "react-router-dom";

import { TypeAnimation } from 'react-type-animation';

function Page404() {
    return(
        <div className="bg-zinc-900 w-screen h-screen flex flex-col items-center justify-center">
            <Link to="/" className="absolute top-10 w-48"><img src={ Logo } alt="Logo"></img></Link>
            <TypeAnimation
      sequence={[
        '404, Page Not Found.',
        () => {
          
        }
      ]}
      wrapper="h1"
      cursor={true}
      repeat={0}
      speed={75}
      className="text-white text-5xl leading-normal text-center"
    />
            <Link to="/" className="block bg-white w-fit text-center font-normal text-sm pt-3 pb-3 pl-7 pr-7 mt-12">Homepage</Link>
        </div>
    );
}

export default Page404;