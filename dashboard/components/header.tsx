import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import CopySession from "./ui/copysession";
import { FaGithub } from "react-icons/fa";

export default function Header() {
  return (
    <div className="sticky rounded-2xl top-0 md:mx-10 my-5 flex flex-row items-center justify-between bg-[#141414]/50 backdrop-blur-md p-5 z-50">
      <h1 className="text-white text-5xl flex-row items-center justify-center space-x-2 hidden md:flex">
        <p className="font-semibold font-sans flex flex-row items-start justify-center space-x-4"> 
          <span className="font-thin">Turbo</span>DA
        </p>
      </h1>
      <img
        src="/tokens/0xb1c3cb9b5e598d4e95a85870e7812b99f350982d.png"
        className="md:hidden flex w-8"
        alt="Logo"
      ></img>
      <div className="flex flex-row items-center justify-center space-x-4 !text-white !font-mono">
        <a href="https://github.com/availproject/turbo-da">
        <FaGithub className="w-6 h-6" />
        </a>
        <SignedOut>
          <button className="bg-[#1D1D1D] rounded-lg p-2 text-white text-opacity-80 hover:text-opacity-100">
            <SignInButton mode="modal" />
          </button>
        </SignedOut>
        <SignedIn>
          <CopySession />
          <UserButton />
        </SignedIn>
      </div>
    </div>
  );
}
